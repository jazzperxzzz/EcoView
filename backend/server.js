
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.REST_COUNTRIES_API_KEY;

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed"));
  }
}));

app.use(express.json());

const countryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "EcoView backend is running."
  });
});

// Country information
app.get("/api/country/:code", countryLimiter, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    if (!/^[A-Z]{2}$/.test(code)) {
      return res.status(400).json({
        error: "Invalid country code."
      });
    }

    if (!API_KEY) {
      return res.status(500).json({
        error: "API key is not configured."
      });
    }

    const fields = [
      "names",
      "capitals",
      "population",
      "region",
      "subregion",
      "timezones",
      "currencies",
      "languages",
      "flag.url_svg"
    ].join(",");

    const url =
      `https://api.restcountries.com/countries/v5/codes.alpha_2/${code}` +
      `?response_fields=${encodeURIComponent(fields)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`
      },
      signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("REST Countries returned:", response.status);

      return res.status(response.status).json({
        error: "Unable to retrieve country information."
      });
    }

    // Preserve the original API response structure.
    res.json(data);

  } catch (error) {
    console.error("Country API error:", error.message);

    res.status(502).json({
      error: "Country information service is unavailable."
    });
  }
});

app.listen(PORT, () => {
  console.log(`EcoView backend running at http://localhost:${PORT}`);
});
