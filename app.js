const express = require("express");
const { tmpdir } = require("os");
const { join } = require("path");
const fs = require("fs").promises;
const cors = require("cors");
const bodyParser = require("body-parser");
// const { main } = require("./email");
const eanSearch = require("./ean")
const app = express();
const port = 3000;
// main();
app.use(
  cors({ 
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: "Content-Type, Authorization",
  })
);

app.use(express.json()); // Use express.json() before multer
app.use(bodyParser.json({ limit: "50mb" }));
app.use(
  express.urlencoded({
    extended: false,
    parameterLimit: 1000000,
    limit: "500mb",
  })
);

app.get("/api/eanSearch", async (req, res) => {
  try {
    const { query } = req.query;
    console.log(query);
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter" });
    }

    const result = await eanSearch(query);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in eanSearch:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});


// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });
// const { exec } = require("child_process");

// exec("java -version", (error, stdout, stderr) => {
//   if (error) {
//     console.error(`Error executing command: ${error.message}`);
//     return;
//   }

//   // Extracting Java version from the output
//   const match = stderr.match(/(?:java|openjdk) version "(\d+\.\d+)/);
//   const javaVersion = match ? match[1] : "Java version not found";

//   // Logging Java version
//   console.log(`Java Version: ${javaVersion}`);
// });

// app.post("/api/getPoData", async (req, res) => {
//   try {
//     const { poData, fileName } = req.body;

//     console.log(poData, fileName);

//     if (!poData) {
//       return res.status(400).json({ error: poData });
//       // .json({ error:  `Missing PO Data in the request body` + poDatax});
//     }

//     const jsonString = JSON.stringify(poData, null, 2);

//     // const tmpFilePath = `../vmsaccounts/storage/uploads/purchaseOrder/2024/Jan/18/${currentyear}_${currentmonth}_${currentday}.json`;
//     // const tmpFilePath = `C:/Users/ayush/OneDrive/Documents/GitHub/vmsaccounts/storage/uploads/purchaseOrder/2024/Jan/18/${currentyear}_${currentmonth}_${currentday}.json`;
//     const tmpFilePath = `../httpdocs/storage/uploads/purchaseOrder/${Po_date}${currentyear}_${currentmonth}_${currentday}.json`;
//     // const tmpFilePath = `../vmsaccounts/storage/uploads/purchaseOrder/${Po_date}${fileName}.json`;
//     await fs.writeFile(tmpFilePath, jsonString, "utf-8");

//     console.log(`Data has been written to ${tmpFilePath}`);
//     res
//       .status(200)
//       .json({ message: "Data received successfully", data: JSON.parse(jsonString, null, 2) });
//   } catch (err) {
//     console.error("Error writing to file:", err);
//     res.status(500).json({ error: `Error writing to file` });
//   }
// });

app.get('/', (req, res) => {
  res.send('Hello, this is a test message!');
});

app.post('/test', (req, res) => {
  res.json({ status: 'Received POST request without any specific body' });
});

// app.post("/api/fill", upload.single("file"), async (req, res) => {
//   try {
//     const { buffer, originalname } = req.file;
//     const { area } = req.body;

//     if (!buffer || !originalname || !area) {
//       return res.status(400).json({ error: "Invalid request parameters" });
//     }

//     const { left, top, right, bottom } = JSON.parse(area);
//     console.log("Area :: ", left, top, right, bottom);

//     const tmpFilePath = join(tmpdir(), originalname);
//     await fs.writeFile(tmpFilePath, buffer);

//     const t = tabula(tmpFilePath, {
//       area: `${top - 36.34}, ${left - 27.82}, ${bottom - 55.45}, ${
//         right - 28.66
//       }`,
//     });

//     t.extractCsv((err, data) => {
//       if (err) {
//         console.error(err);
//         res.status(500).json({ error: "Error extracting CSV" });
//       } else {
//         const filteredData = data.filter((item) => item !== "");
//         res.json({ success: true, data: filteredData });
//       }
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Error processing the file" });
//   }
// });

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// ngrok.connect({ addr: port, authtoken: "2ctdWtOzzUnOkzcHW6azeaniKDj_3S1rC23zPea9rd7EjLnGJ",subdomain: 'full-vulture-firm',})
//   .then(listener => console.log(`Ingress established at: ${listener.url()}`));

  // (async () => {
  //   const tunnel = await localtunnel({ port: port });
  //   tunnel.url;
  // console.log("lt:", tunnel.url);
  //   // tunnel.on('close', () => {
  //   //   // tunnels are closed
  //   // });
  // })();

const purchaseDate = new Date();
const currentyear = purchaseDate.getFullYear();
const currentmonth = purchaseDate.toLocaleString("default", { month: "short" });
const currentday = purchaseDate.getDate().toString().padStart(2, "0");

const Po_date = `${currentyear}/${currentmonth}/${currentday}/`;

module.exports = app;
