# EcoView – Environmental Monitoring Dashboard

**Smarter Data. Greener Tomorrow.**

EcoView is a web-based environmental monitoring dashboard that provides users with accessible information about weather conditions, air quality, and country-related environmental data. It brings together information from external APIs into one dashboard to help users understand their local environmental conditions.

## Features

- **Weather Monitoring** – Displays current weather conditions, temperature, humidity, wind speed, and a 7-day forecast.
- **Air Quality Monitoring** – Displays the Air Quality Index (AQI) and pollutant concentrations, including PM2.5, CO, NO₂, and O₃.
- **Country Information** – Displays country details such as capital, population, region, currency, languages, and national flag.
- **Environmental Status** – Provides an overview of current environmental conditions.
- **Data Visualization** – Presents environmental information through charts and graphs.
- **Location Search** – Allows users to search for different cities and view their environmental information.
- **Temperature Conversion** – Supports Celsius and Fahrenheit display.

## Technologies Used

### Frontend
- HTML5
- CSS3
- JavaScript
- Chart.js

### Backend
- Node.js
- Express.js
- REST Countries API authentication through a backend endpoint
- dotenv
- CORS
- Helmet
- Express Rate Limit

### External APIs
- [Open-Meteo Weather API](https://open-meteo.com/)
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)
- [REST Countries API](https://restcountries.com/)

## Project Structure

```text
EcoView/
│
├── backend/
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
│
├── css/
│   └── style.css
│
├── images/
│
├── js/
│   └── dashboard.js
│
├── index.html
├── README.md
└── .gitignore
```

## Installation and Setup

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)
- VS Code Live Server extension

### 1. Clone the repository

```bash
git clone https://github.com/jazzperxzzz/EcoView.git
```

Navigate to the project directory:

```bash
cd EcoView
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `backend` folder.

Use the `.env.example` file as your reference:

```env
PORT=3000
REST_COUNTRIES_API_KEY=YOUR_API_KEY_HERE
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

Replace `YOUR_API_KEY_HERE` with your own REST Countries API key.

**Important:** Never upload your actual `.env` file or API key to GitHub.

### 4. Start the backend server

Inside the `backend` folder, run:

```bash
npm start
```

The backend should run at:

```text
http://localhost:3000
```

### 5. Launch the frontend

Open the project in Visual Studio Code.

Right-click `index.html` and select **Open with Live Server**.

EcoView should now be accessible through your local browser.

## Security

- API credentials are stored in environment variables.
- The REST Countries API request is handled through the Express backend.
- The `.env` file is excluded from version control using `.gitignore`.

## Project Purpose

EcoView was developed as an academic project to demonstrate the integration of external APIs, frontend and backend development, environmental data visualization, and interactive web technologies.

---

**EcoView – Smarter Data. Greener Tomorrow.**
