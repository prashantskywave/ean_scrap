const cheerio = require("cheerio");
const puppeteerExtra = require("puppeteer-extra");
const stealthPlugin = require("puppeteer-extra-plugin-stealth");


puppeteerExtra.use(stealthPlugin());

const currencySymbolToCode = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "Ƀ": "BTC",
  "₽": "RUB",
  "₪": "ILS",
  "₴": "UAH",
  "₩": "KRW",
  "₨": "PKR",
  "₱": "PHP",
  "﷼": "SAR",
  "₦": "NGN",
  "฿": "THB",
  "₺": "TRY",
  "₡": "CRC",
  "₮": "MNT",
  "₾": "GEL",
  "L": "HNL",
  "₵": "GHS",
  "Q": "GTQ",
  "ZK": "ZMW",
  "R$": "BRL",
  "AU$": "AUD",
  "NZ$": "NZD",
  "RM": "MYR",
  "S$": "SGD",
  "Af": "AFN",
  // Add more symbols as needed
};

async function eanSearch(query) {
  const start = Date.now();
  let browser;

  try {
    browser = await puppeteerExtra.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true, 
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.google.com/', ['geolocation']);

    const page = await browser.newPage();

    await page.setGeolocation({ latitude: 90, longitude: 0 });

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    const allBusinesses = [];

    async function scrapeCurrentPage() {
      const html = await page.content();
      const $ = cheerio.load(html);
      const searchResults = $('div.g');
      const pageBusinesses = [];
      const uniqueProductLinks = new Set();

      searchResults.each((i, result) => {
        try {
          const resultBlock = $(result);
          const linkElement = resultBlock.find('a').first();
          const url = linkElement.attr('href');

          if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) {
            return;
          }

          if (uniqueProductLinks.has(url)) {
            return;
          }
          uniqueProductLinks.add(url);

          const name = resultBlock.find('h3').first().text().trim() || 'NA';

          const website = resultBlock.find('span.VuuXrf').first().text().trim() || 'NA';

          let price = 'NA';
          let currencySymbol = 'NA';

          resultBlock.find('*').each((j, elem) => {
            const text = $(elem).text();
            const match = text.match(/([$€£¥₹₴₣£₪₦₱฿₽])/);
            if (match) {
              const symbol = match[0];
              const priceMatch = text.match(/([$€£¥₹₴₣£₪₦₱฿₽])\s?([\d,]+(?:\.\d+)?)/);
              if (priceMatch) {
                currencySymbol = priceMatch[1];
                price = parseFloat(priceMatch[2].replace(/,/g, ''));
                return false; 
              }
            }
          });

          const currencyCode = currencySymbolToCode[currencySymbol] || 'NA';

          pageBusinesses.push({
            price: isNaN(price) ? 'NA' : price,
            gbpPrice: 'NA',
            currencyCode,
            productLink: url,
            site: (new URL(url)).hostname.replace(/^www\./, ''),
            name,
          });
        } catch (err) {
          console.error('Error processing a search result:', err);
        }
      });

      return pageBusinesses;
    }

    async function autoScrollAndHandlePagination(page, maxPages = 3) {
      let currentPage = 1;

      while (currentPage <= maxPages) {
        console.log(`Scraping Page ${currentPage}...`);

        await page.evaluate(async () => {
          await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const delay = 200; // ms
    
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
    
              if (totalHeight >= scrollHeight - window.innerHeight) {
                clearInterval(timer);
                resolve();
              }
            }, delay);
          });
        });
    
        const randomDelay = Math.floor(Math.random() * 1000) + 500; 
        await new Promise(resolve => setTimeout(resolve, randomDelay));

        const pageBusinesses = await scrapeCurrentPage();
        allBusinesses.push(...pageBusinesses);

        if (currentPage < maxPages) {
          const nextButtonSelector = 'a#pnnext';
          const nextButton = await page.$(nextButtonSelector);
          if (nextButton) {
            console.log(`Navigating to Page ${currentPage + 1}...`);
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2' }),
              nextButton.click(),
            ]);
            currentPage++;
          } else {
            console.log("No more pages found.");
            break;
          }
        } else {
          break;
        }
      }
    }

    await autoScrollAndHandlePagination(page, 3);

    await browser.close();
    console.log("Browser closed");

    await fetchExchangeRates(allBusinesses);

    allBusinesses.sort((a, b) => {
      if (a.gbpPrice === 'NA') return 1;
      if (b.gbpPrice === 'NA') return -1;
      return a.gbpPrice - b.gbpPrice;
    });

    const end = Date.now();
    console.log(`Time taken: ${Math.floor((end - start) / 1000)} seconds`);
    console.log(`Total listing found: ${allBusinesses.length}`);

    return allBusinesses;
  } catch (error) {
    console.error("Error in eanSearch:", error.message);
    console.error(error);
    if (browser) {
      await browser.close();
      console.log("Browser closed due to error");
    }
    return [];
  }
}
async function fetchExchangeRates(businesses) {
  try {
    const uniqueCurrencies = [...new Set(businesses
      .map(b => b.currencyCode)
      .filter(c => c !== 'NA' && c !== 'GBP'))];

    const exchangeRates = {};
    await Promise.all(uniqueCurrencies.map(async (code) => {
      try {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${code}`);
        if (!response.ok) throw new Error(`Failed to fetch rates for ${code}`);
        const data = await response.json();
        exchangeRates[code] = data.rates.GBP;
      } catch (error) {
        console.error(`Error fetching exchange rate for ${code}:`, error.message);
      }
    }));

    businesses.forEach(entry => {
      if (entry.currencyCode === 'GBP') {
        entry.gbpPrice = entry.price;
      } else if (exchangeRates[entry.currencyCode]) {
        entry.gbpPrice = parseFloat((entry.price * exchangeRates[entry.currencyCode]).toFixed(2));
      } else {
        entry.gbpPrice = 'NA';
      }
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error.message);
  }
}

module.exports = eanSearch;