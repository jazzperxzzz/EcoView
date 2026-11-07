const BACKEND_URL = "http://localhost:3000";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const state = {
  place: null,
  weather: null,
  unit: "C",
  view: "dashboard",
  requestId: 0
};

const charts = {};
let currentTZ = "UTC";
let suggestionRequestId = 0;

const $ = (id) => document.getElementById(id);

function showError(msg) {
  $("errorMessage").textContent = msg;
  $("error").hidden = false;
}

function setLoading(isLoading) {
  $("loading").hidden = !isLoading;
  document.body.classList.toggle("is-loading", isLoading);
}

async function getJSON(url, options) {
  const res = await fetch(url, options);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
  }

  return res.json();
}

const round = (n, decimals = 1) =>
  Number.isFinite(n) ? n.toFixed(decimals) : "--";

function fmtT(celsius, decimals = 1) {
  const value = toDisplayTemperature(celsius);
  if (value == null) return "--";

  return value.toFixed(decimals) + "°" + state.unit;
}

function toDisplayTemperature(celsius) {
  if (!Number.isFinite(celsius)) return null;
  return state.unit === "C" ? celsius : celsius * 9 / 5 + 32;
}

function humidityLabel(percent) {
  if (!Number.isFinite(percent)) return "--";
  if (percent < 30) return "Dry";
  if (percent < 60) return "Comfortable";
  if (percent < 80) return "Humid";
  return "Very humid";
}

function windLabel(kmh) {
  if (!Number.isFinite(kmh)) return "--";
  if (kmh < 2) return "Calm";
  if (kmh < 12) return "Light breeze";
  if (kmh < 29) return "Moderate breeze";
  if (kmh < 50) return "Strong wind";
  return "Storm-force";
}

function weatherInfo(code) {
  if (!Number.isFinite(code)) return ["cloud", "No data"];
  if (code === 0) return ["sun", "Clear sky"];
  if (code <= 2) return ["cloud-sun", "Partly cloudy"];
  if (code === 3) return ["cloud", "Overcast"];
  if (code <= 48) return ["cloud-fog", "Fog"];
  if (code <= 57) return ["cloud-drizzle", "Drizzle"];
  if (code <= 67) return ["cloud-rain", "Rain"];
  if (code <= 77) return ["snowflake", "Snow"];
  if (code <= 82) return ["cloud-rain", "Rain showers"];
  if (code <= 86) return ["cloud-snow", "Snow showers"];
  if (code >= 95 && code <= 99) return ["cloud-lightning", "Thunderstorm"];
  return ["cloud", "Unknown conditions"];
}

function iconMarkup(name, className = "") {
  return `<i class="ui-icon ${className}" data-lucide="${name}" aria-hidden="true"></i>`;
}

function renderIcons() {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

renderIcons();

function aqiInfo(aqi) {
  if (!Number.isFinite(aqi)) {
    return ["--", "#888", "No air quality data available."];
  }

  if (aqi <= 50) {
    return ["Good", "#79b89a", "Conditions are favorable for outdoor activities."];
  }

  if (aqi <= 100) {
    return ["Moderate", "#c5ad62", "Sensitive people should limit long outdoor exertion."];
  }

  if (aqi <= 150) {
    return ["Unhealthy (SG)", "#ca8d5e", "Sensitive groups should reduce outdoor activity."];
  }

  if (aqi <= 200) {
    return ["Unhealthy", "#c56f6b", "Everyone should limit outdoor exertion."];
  }

  if (aqi <= 300) {
    return ["Very Unhealthy", "#9d83b6", "Avoid outdoor activity."];
  }

  return ["Hazardous", "#b65f70", "Stay indoors."];
}

function formatCurrencies(currencies) {
  if (!currencies) return "--";

  let entries = [];

  if (Array.isArray(currencies)) {
    entries = currencies
      .map((c) =>
        typeof c === "string"
          ? c
          : c?.code || c?.symbol || c?.name
      )
      .filter(Boolean);

  } else if (typeof currencies === "object") {
    entries = Object.entries(currencies).map(([code, info]) => {
      if (info && typeof info === "object") {
        return info.name || info.symbol || code;
      }

      return code;
    });
  }

  entries = entries.filter(
    (e) => e !== undefined && e !== null && e !== "" && e !== 0
  );

  return entries.length ? entries.join(", ") : "--";
}

const MASCOTS = [
  { max: 50, file: "01_good_mascot.png" },
  { max: 100, file: "02_moderate_mascot.png" },
  { max: 150, file: "03_sensitive_groups_mascot.png" },
  { max: 200, file: "04_unhealthy_mascot.png" },
  { max: Infinity, file: "05_hazardous_mascot.png" }
];

function setMascot(aqi) {
  const img = $("mascotImg");

  if (!Number.isFinite(aqi)) {
    img.hidden = true;
    return;
  }

  const band = MASCOTS.find((m) => aqi <= m.max);

  img.src = "images/" + band.file;
  img.alt = "Mascot for " + aqiInfo(aqi)[0] + " air quality";

  img.onerror = () => {
    img.hidden = true;
  };

  img.onload = () => {
    img.hidden = false;
  };
}

function tickClock() {
  const now = new Date().toLocaleString("en-US", {
    timeZone: currentTZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  $("clockText").textContent = now;
}

setInterval(tickClock, 1000);

// LOCATION SEARCH

async function searchPlaces(name) {
  const query = name.trim();
  if (query.length < 2) return [];

  const isPhilippines =
    /philippines|aurora|zamboanga|cebu|manila|tangub/i.test(query);

  const url =
    `${GEO_URL}?name=${encodeURIComponent(query)}` +
    `&count=10` +
    `&language=en` +
    `&format=json` +
    (isPhilippines ? `&countryCode=PH` : "");

  const data = await getJSON(url);
  return data.results || [];
}

async function showSuggestions(query) {
  const requestId = ++suggestionRequestId;
  const ul = $("suggestions");

  try {
    const list = await searchPlaces(query);
    if (
      requestId !== suggestionRequestId ||
      $("searchInput").value.trim() !== query
    ) return;

    ul.replaceChildren();

    list.forEach((place) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      const details = document.createElement("small");

      name.textContent = place.name;
      details.textContent = [
        place.admin1,
        place.country
      ].filter(Boolean).join(", ");
      li.append(name, " ", details);
      li.addEventListener("click", () => selectPlace(place));
      ul.appendChild(li);
    });

    ul.hidden = list.length === 0;
  } catch (err) {
    if (requestId === suggestionRequestId) {
      ul.hidden = true;
      showError("Location search failed: " + err.message);
    }
  }
}

function selectPlace(place) {
  state.place = place;

  $("suggestions").hidden = true;
  $("searchInput").value = "";

  loadDashboard(place);
}

let searchDebounce;

$("searchInput").addEventListener("input", (e) => {
  clearTimeout(searchDebounce);

  const query = e.target.value.trim();

  if (query.length < 2) {
    suggestionRequestId += 1;
    $("suggestions").hidden = true;
    return;
  }

  searchDebounce = setTimeout(
    () => showSuggestions(query),
    350
  );
});

$("searchInput").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();

  const query = e.target.value.trim();
  if (query.length < 2) return;

  try {
    const results = await searchPlaces(query);
    if ($("searchInput").value.trim() !== query) return;

    if (results.length) {
      selectPlace(results[0]);
    } else {
      showError("No location found. Try another spelling.");
    }
  } catch (err) {
    showError("Location search failed: " + err.message);
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) {
    $("suggestions").hidden = true;
  }
});

document.querySelectorAll(".chips button").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      const results = await searchPlaces(button.dataset.q);

      if (results.length) {
        selectPlace(results[0]);
      } else {
        showError("No location found for " + button.textContent.trim() + ".");
      }
    } catch (err) {
      showError("Location search failed: " + err.message);
    }
  });
});

// NAVIGATION

const VIEWS = {
  dashboard: [
    "Environmental Monitoring Dashboard",
    "Current weather, air quality and environmental data"
  ],

  weather: [
    "Weather",
    "Current conditions, temperature trend and 7-day forecast"
  ],

  air: [
    "Air Quality",
    "Pollutant levels, what they mean, and how healthy the air is"
  ],

  country: [
    "Country Info",
    "Facts about the country of the selected location"
  ]
};

function setView(view) {
  state.view = view;

  document.querySelectorAll("[data-views]").forEach((el) => {
    el.hidden = !el.dataset.views.split(" ").includes(view);
  });

  document.querySelectorAll(".grid").forEach((grid) => {
    grid.hidden = !Array.from(grid.children).some((child) => !child.hidden);
  });

  document.querySelectorAll("nav button").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.view === view
    );
  });

  $("viewTitle").textContent = VIEWS[view][0];
  $("viewSub").textContent = VIEWS[view][1];

  document.body.classList.toggle(
    "country-view",
    view === "country"
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  Object.values(charts).forEach((chart) => chart.resize());
}

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.view);
  });
});

$("unitBtn").addEventListener("click", () => {
  state.unit = state.unit === "C" ? "F" : "C";

  $("unitBtn").textContent = "°C / °F";
  $("unitBtn").title = "Switch temperature unit (currently °" + state.unit + ")";

  if (state.weather) {
    renderWeather(state.weather);
  }
});

$("refreshBtn").addEventListener("click", () => {
  if (state.place) {
    loadDashboard(state.place);
  }
});

// DASHBOARD DATA

function clearDashboardData() {
  [
    "temp", "condition", "humidity", "wind", "feels", "summary",
    "trendNote", "barNote", "aqiNum", "aqiLabel", "pm25", "co", "no2",
    "o3", "statusText", "statusAdvice", "selectedLocation", "capital", "population", "region",
    "tz", "currency", "languages"
  ].forEach((id) => {
    $(id).textContent = "--";
  });

  $("countryTitle").textContent = "Country";
  $("statusText").style.removeProperty("color");
  $("forecast").replaceChildren();
  $("pollTable").replaceChildren();
  $("mascotImg").hidden = true;
  $("flag").hidden = true;
  $("flag").removeAttribute("src");
  $("aqiMarker").style.left = "0";
  $("mapLink").removeAttribute("href");

  Object.keys(charts).forEach((id) => {
    charts[id].destroy();
    delete charts[id];
  });
}

async function loadDashboard(place) {
  if (
    !place ||
    !Number.isFinite(place.latitude) ||
    !Number.isFinite(place.longitude)
  ) {
    showError("The selected location has invalid coordinates.");
    return;
  }

  const requestId = ++state.requestId;
  state.place = place;
  $("error").hidden = true;
  setLoading(true);
  state.weather = null;
  clearDashboardData();

  currentTZ = place.timezone || "UTC";

  $("locationText").textContent =
    [place.name, place.admin1, place.country]
      .filter(Boolean)
      .join(", ");

  $("overallBadge").textContent = "Air quality: —";
  $("updatedIcon").hidden = true;
  $("updatedText").textContent = "Loading…";
  tickClock();

  const { latitude: lat, longitude: lon } = place;

  const weatherQuery =
    `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&timezone=auto&past_days=7&forecast_days=7` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean`;

  const airQuery =
    `${AIR_URL}?latitude=${lat}&longitude=${lon}&timezone=auto` +
    `&current=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;

  // Country information now comes through our Express backend.
  // The API key is stored securely in the backend .env file.

  const countryQuery =
    `${BACKEND_URL}/api/country/${encodeURIComponent(place.country_code)}`;

  // Run all three API calls at once.
  // One failed request will not block the other two.

  try {
    const [
      weatherResult,
      airResult,
      countryResult
    ] = await Promise.allSettled([
      getJSON(weatherQuery),
      getJSON(airQuery),
      getJSON(countryQuery)
    ]);

    if (requestId !== state.requestId) return;

    const errors = [];

    if (weatherResult.status === "fulfilled") {
      try {
        renderWeather(weatherResult.value);
        state.weather = weatherResult.value;
      } catch (err) {
        errors.push("Weather data could not be displayed: " + err.message);
      }
    } else {
      errors.push("Weather data unavailable: " + weatherResult.reason.message);
    }

    if (airResult.status === "fulfilled") {
      try {
        renderAir(airResult.value);
      } catch (err) {
        errors.push("Air quality data could not be displayed: " + err.message);
      }
    } else {
      errors.push("Air quality data unavailable: " + airResult.reason.message);
    }

    if (countryResult.status === "fulfilled") {
      try {
        renderCountry(countryResult.value, place);
      } catch (err) {
        renderCountry(null, place);
        errors.push("Country info could not be displayed: " + err.message);
      }
    } else {
      renderCountry(null, place);
      const countrySetupHint = window.location.protocol === "file:"
        ? " Start the backend from the backend folder with npm.cmd start."
        : " Check that the backend is running with npm.cmd start from the backend folder and that this page's origin is listed in backend/.env CORS_ORIGINS.";
      errors.push(
        "Country info unavailable (" +
        countryResult.reason.message +
        "). Showing basic details only." +
        countrySetupHint
      );
    }

    $("mapLink").href =
      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}`;

    $("updatedIcon").outerHTML = iconMarkup(
      errors.length ? "triangle-alert" : "circle-check"
    ).replace("<i ", '<i id="updatedIcon" ');
    renderIcons();
    $("updatedText").textContent =
      (errors.length ? "Partially updated " : "Updated ") +
      new Date().toLocaleTimeString("en-US", {
        timeZone: currentTZ,
        hour: "2-digit",
        minute: "2-digit"
      });

    if (errors.length) showError(errors.join(" "));
  } catch (err) {
    if (requestId === state.requestId) {
      showError("Dashboard data could not be displayed: " + err.message);
    }
  } finally {
    if (requestId === state.requestId) setLoading(false);
  }
}

// WEATHER

function renderWeather(data) {
  const current = data.current;
  const daily = data.daily;

  const [, description] = weatherInfo(current.weather_code);

  const humidity = humidityLabel(current.relative_humidity_2m);

  const wind = windLabel(current.wind_speed_10m);

  $("temp").textContent = fmtT(current.temperature_2m);
  $("condition").textContent = description;

  $("humidity").textContent = Number.isFinite(current.relative_humidity_2m)
    ? `${current.relative_humidity_2m}% · ${humidity}`
    : "--";

  $("wind").textContent = Number.isFinite(current.wind_speed_10m)
    ? `${round(current.wind_speed_10m)} km/h · ${wind}`
    : "--";

  $("feels").textContent =
    fmtT(current.apparent_temperature);

  const isRaining =
    (current.weather_code >= 51 && current.weather_code <= 67) ||
    current.weather_code >= 80;

  const feelsDiff = Number.isFinite(current.apparent_temperature) &&
    Number.isFinite(current.temperature_2m)
    ? current.apparent_temperature - current.temperature_2m
    : null;

  const feelsNote = feelsDiff != null && Math.abs(feelsDiff) >= 1.5
    ? `It feels ${feelsDiff > 0 ? "warmer" : "cooler"} than the thermometer says.`
    : "";

  const summaryParts = [
    description !== "No data" ? description : "",
    humidity !== "--" ? `${humidity.toLowerCase()} air` : "",
    wind !== "--" ? `a ${wind.toLowerCase()}` : ""
  ].filter(Boolean);

  let summary = summaryParts.join(", ");
  if (feelsNote) summary += `${summary ? ". " : ""}${feelsNote}`;
  if (isRaining) summary += `${summary ? " " : ""}Bring an umbrella.`;
  $("summary").textContent = summary;

  const pastMeans = daily.temperature_2m_mean.slice(0, 7);
  const pastDates = daily.time.slice(0, 7);

  const validPastMeans = pastMeans.filter(Number.isFinite);
  const firstMean = pastMeans.find(Number.isFinite);
  const lastMean = [...pastMeans].reverse().find(Number.isFinite);
  let trendNote = validPastMeans.length
    ? `Averages ranged from ${fmtT(Math.min(...validPastMeans))} to ${fmtT(Math.max(...validPastMeans))}.`
    : "No temperature trend data available.";

  if (firstMean != null && lastMean != null) {
    const weekChange = lastMean - firstMean;
    trendNote += ` ${Math.abs(weekChange) < 0.5
      ? "Temperatures stayed steady."
      : `Overall it got ${weekChange > 0 ? "warmer" : "cooler"} over the week.`}`;
  }
  $("trendNote").textContent = trendNote;

  drawChart("tempChart", "line", {
    labels: pastDates.map((date) =>
      new Date(date + "T00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" }
      )
    ),

    datasets: [{
      label: "Average °" + state.unit,

      data: pastMeans.map(toDisplayTemperature),

      borderColor: "#79b89a",
      backgroundColor: "rgba(121,184,154,.12)",
      pointBackgroundColor: "#79b89a",
      pointBorderColor: "#79b89a",
      pointHoverBackgroundColor: "#a4cdb7",
      pointHoverBorderColor: "#a4cdb7",
      fill: true,
      tension: 0.38,
      borderWidth: 2.5,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointHoverBorderWidth: 2
    }]
  }, {
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || "",
          label: (item) =>
            ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}°${state.unit}`
        }
      }
    }
  });

  const futureDates = daily.time.slice(7, 14);

  const futureHighs = daily.temperature_2m_max
    .slice(7, 14)
    .map(toDisplayTemperature);

  $("barNote").textContent =
    `Daily highs for the coming week, in °${state.unit}. Compare bars to see which day will be hottest.`;

  drawChart(
    "tempBarChart",
    "bar",
    {
      labels: futureDates.map((date, i) =>
        i === 0
          ? "Today"
          : new Date(date + "T00:00").toLocaleDateString(
              "en-US",
              { weekday: "short" }
            )
      ),

      datasets: [{
        label: "High °" + state.unit,
        data: futureHighs,
        backgroundColor: "#789db8",
        hoverBackgroundColor: "#9bb6c9",
        borderColor: "#789db8",
        hoverBorderColor: "#9bb6c9",
        borderWidth: 0,
        borderRadius: { topLeft: 5, topRight: 5 },
        borderSkipped: "bottom",
        barPercentage: 0.72,
        categoryPercentage: 0.76
      }]
    },
    {
      plugins: {
        legend: { display: false },

        tooltip: {
          intersect: false,
          callbacks: {
            title: (items) => {
              const index = items[0]?.dataIndex;
              if (index == null || !futureDates[index]) return "";
              return index === 0
                ? `Today · ${new Date(futureDates[index] + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : new Date(futureDates[index] + "T00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric"
                  });
            },
            label: (item) =>
              ` High: ${item.parsed.y.toFixed(1)}°${state.unit}`
          }
        }
      }
    }
  );

  $("forecast").innerHTML = daily.time
    .slice(7, 14)
    .map((date, i) => {
      const dayIndex = i + 7;

      const [icon, label] = weatherInfo(daily.weather_code[dayIndex]);

      const dt = new Date(date + "T00:00");

      const dayName = i === 0
        ? "Today"
        : dt.toLocaleDateString(
            "en-US",
            { weekday: "short" }
          );

      const dateLabel = dt.toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" }
      );

      const low = fmtT(
        daily.temperature_2m_min[dayIndex],
        0
      );

      const high = fmtT(
        daily.temperature_2m_max[dayIndex],
        0
      );

      return `
        <div class="day">
          <b>${dayName}</b><br>
          <small>${dateLabel}</small>
          <div class="ico">${iconMarkup(icon)}</div>
          ${low} / ${high}<br>
          <small>${label}</small>
        </div>
      `;
    })
    .join("");
  renderIcons();
}

// AIR QUALITY

const POLLUTANTS = [
  [
    "PM2.5",
    "pm2_5",
    "Tiny dust and smoke particles that reach deep into the lungs. From traffic, burning and fires.",
    15
  ],
  [
    "PM10",
    "pm10",
    "Coarser dust, pollen and construction dust. Irritates eyes and throat.",
    45
  ],
  [
    "NO₂",
    "nitrogen_dioxide",
    "Gas from vehicle exhaust and power plants. Can inflame the airways.",
    25
  ],
  [
    "SO₂",
    "sulphur_dioxide",
    "Gas from burning coal and oil, and from volcanoes. Triggers coughing.",
    40
  ],
  [
    "O₃",
    "ozone",
    "Ground-level ozone, formed by sunlight acting on exhaust. Worse on hot afternoons.",
    100
  ],
  [
    "CO",
    "carbon_monoxide",
    "Odourless gas from incomplete burning. Harmful in enclosed spaces.",
    4000
  ]
];

function renderAir(data) {
  const current = data.current;

  const [label, color, advice] =
    aqiInfo(current.us_aqi);

  $("aqiNum").textContent =
    Number.isFinite(current.us_aqi) ? current.us_aqi : "--";

  $("aqiLabel").textContent = label;

  $("pm25").textContent =
    Number.isFinite(current.pm2_5) ? round(current.pm2_5, 0) + " µg/m³" : "--";

  $("co").textContent =
    Number.isFinite(current.carbon_monoxide)
      ? round(current.carbon_monoxide / 1000, 2) + " mg/m³"
      : "--";

  $("no2").textContent =
    Number.isFinite(current.nitrogen_dioxide)
      ? round(current.nitrogen_dioxide, 0) + " µg/m³"
      : "--";

  $("o3").textContent =
    Number.isFinite(current.ozone) ? round(current.ozone, 0) + " µg/m³" : "--";

  $("statusText").textContent = label;
  $("statusText").style.color = color;
  $("statusAdvice").textContent = advice;

  $("overallBadge").textContent =
    "Air quality: " + label;

  setMascot(current.us_aqi);

  const markerPosition = Number.isFinite(current.us_aqi)
    ? Math.max(0, Math.min(current.us_aqi / 300, 1)) * 100
    : 0;
  $("aqiMarker").style.left = `calc(${markerPosition}% - 2px)`;

  $("pollTable").innerHTML = POLLUTANTS
    .map(([name, key, what, guideline]) => {
      const value = current[key];
      const ratio = Number.isFinite(value) ? value / guideline : null;

      let statusClass;
      let statusText;

      if (!Number.isFinite(value)) {
        [statusClass, statusText] = ["warn", "No data"];
      } else if (ratio <= 1) {
        [statusClass, statusText] = ["ok", "Within guideline"];
      } else if (ratio <= 2) {
        [statusClass, statusText] = ["warn", "Above guideline"];
      } else {
        [statusClass, statusText] = ["bad", "Well above"];
      }

      const isCO = key === "carbon_monoxide";

      const shownValue = !Number.isFinite(value)
        ? "--"
        : isCO
          ? `${round(value / 1000, 2)} mg/m³`
          : `${round(value, 0)} µg/m³`;

      const shownLimit = isCO
        ? "4 mg/m³"
        : guideline + " µg/m³";

      return `
        <tr>
          <td><b>${name}</b></td>
          <td>${what}</td>
          <td>${shownValue}</td>
          <td>${shownLimit}</td>
          <td>
            <span class="badge ${statusClass}">
              ${statusText}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  const pollutantNames = [
    "PM2.5",
    "PM10",
    "NO₂",
    "SO₂",
    "O₃"
  ];

  const pollutantValues = [
    current.pm2_5,
    current.pm10,
    current.nitrogen_dioxide,
    current.sulphur_dioxide,
    current.ozone
  ].map((v) => v ?? 0);

  const pollutantColors = [
    "#79b89a",
    "#58a69c",
    "#789db8",
    "#9b85ad",
    "#c3a16d"
  ];

  drawChart(
    "aqiChart",
    "pie",
    {
      labels: pollutantNames,

      datasets: [{
        data: pollutantValues,
        backgroundColor: pollutantColors,
        borderColor: "#102925",
        borderWidth: 2,
        hoverOffset: 5,
        hoverBorderColor: "#dce8e1"
      }]
    },
    {
      radius: "82%",
      layout: {
        padding: { top: 4, right: 8, bottom: 0, left: 8 }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#b8c9c1",
            padding: 14,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            boxHeight: 8,
            generateLabels(chart) {
              const labels = Chart.overrides.pie.plugins.legend.labels.generateLabels(chart);
              const values = chart.data.datasets[0].data;
              const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);

              return labels.map((item) => {
                const value = Number(values[item.index]) || 0;
                const percent = total ? (value / total * 100).toFixed(1) : "0.0";
                return {
                  ...item,
                  text: `${item.text} · ${percent}%`
                };
              });
            }
          }
        },

        tooltip: {
          callbacks: {
            label: (item) => {
              const values = item.dataset.data;
              const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
              const value = Number(item.parsed) || 0;
              const percent = total ? (value / total * 100).toFixed(1) : "0.0";
              return ` ${item.label}: ${value.toFixed(1)} µg/m³ (${percent}%)`;
            }
          }
        }
      }
    }
  );
}

// COUNTRY INFORMATION

function renderCountry(data, place) {
  const country = data?.data?.objects?.[0];

  const countryCode =
    (place.country_code || "").toLowerCase();

  $("selectedLocation").textContent =
    [place.name, place.admin1].filter(Boolean).join(", ") || "--";

  $("countryTitle").textContent =
    country?.names?.common || place.country || "Country";

  if (countryCode) {
    $("flag").src =
      country?.flag?.url_svg ||
      `https://flags.restcountries.com/v5/w160/${countryCode}.png`;

    $("flag").hidden = false;
  } else {
    $("flag").removeAttribute("src");
    $("flag").hidden = true;
  }

  $("capital").textContent =
    country?.capitals?.[0]?.name || "--";

  $("population").textContent =
    country?.population
      ? country.population.toLocaleString()
      : (
          place.population
            ? place.population.toLocaleString() + " (city)"
            : "--"
        );

  $("region").textContent =
    country
      ? [country.subregion, country.region]
          .filter(Boolean)[0] || "--"
      : place.country || "--";

  $("tz").textContent =
    place.timezone || country?.timezones?.[0] || "--";

  $("currency").textContent =
    formatCurrencies(country?.currencies);

  $("languages").textContent =
    Array.isArray(country?.languages)
      ? country.languages
          .slice(0, 2)
          .map((l) =>
            l.name?.english ||
            l.name_english ||
            l.name ||
            l.english ||
            ""
          )
          .filter(Boolean)
          .join(", ") || "--"
      : "--";
}

// CHARTS

function drawChart(
  canvasId,
  type,
  data,
  extraOptions = {},
  centerText
) {
  if (typeof Chart === "undefined") {
    showError("Charts are unavailable because the chart library could not be loaded.");
    return;
  }

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  Chart.defaults.color = "#a3b5ad";
  Chart.defaults.font.family = '"Segoe UI", system-ui, sans-serif';
  Chart.defaults.font.size = 11;

  const centerTextPlugin = {
    id: "center",

    afterDraw(chart) {
      if (centerText == null || type !== "doughnut") {
        return;
      }

      const { ctx, chartArea: area } = chart;

      const x = (area.left + area.right) / 2;
      const y = (area.top + area.bottom) / 2 + 8;

      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#dce8e1";
      ctx.font = "bold 28px Segoe UI";
      ctx.fillText(centerText, x, y);
      ctx.restore();
    }
  };

  const scales =
    (type === "doughnut" || type === "pie")
      ? {}
      : {
          x: {
            grid: { color: "#29443f" },
            border: { display: false },
            ticks: {
              color: "#a3b5ad",
              maxRotation: 0,
              autoSkipPadding: 8
            }
          },

          y: {
            grid: { color: "#29443f" },
            border: { display: false, dash: [3, 4] },
            ticks: {
              color: "#a3b5ad",
              padding: 8
            },
            beginAtZero: type === "bar"
          }
        };

  const percentageLabels = {
    id: "piePercentageLabels",
    afterDatasetsDraw(chart) {
      if (type !== "pie") return;

      const values = chart.data.datasets[0].data;
      const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
      if (!total) return;

      const { ctx } = chart;
      const arcs = chart.getDatasetMeta(0).data;
      ctx.save();
      ctx.font = "600 11px Segoe UI, system-ui, sans-serif";
      ctx.fillStyle = "#edf2ee";
      ctx.strokeStyle = "rgba(8,23,20,.84)";
      ctx.lineWidth = 2.5;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      arcs.forEach((arc, index) => {
        const value = Number(values[index]) || 0;
        const percent = value / total * 100;
        if (percent < 5) return;

        const { x, y, startAngle, endAngle, outerRadius, innerRadius } =
          arc.getProps(["x", "y", "startAngle", "endAngle", "outerRadius", "innerRadius"], true);
        const angle = (startAngle + endAngle) / 2;
        const radius = (outerRadius + (innerRadius || 0)) / 2;

        const label = `${percent.toFixed(0)}%`;
        const labelX = x + Math.cos(angle) * radius;
        const labelY = y + Math.sin(angle) * radius;
        ctx.strokeText(label, labelX, labelY);
        ctx.fillText(label, labelX, labelY);
      });

      ctx.restore();
    }
  };

  const extraPlugins = extraOptions.plugins || {};
  const extraLegend = extraPlugins.legend || {};
  const extraTooltip = extraPlugins.tooltip || {};

  charts[canvasId] = new Chart($(canvasId), {
    type,
    data,
    plugins: [centerTextPlugin, percentageLabels],

    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales,

      ...extraOptions,

      plugins: {
        ...extraPlugins,

        legend: {
          display: type !== "line",
          ...extraLegend,
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            boxHeight: 8,
            padding: 12,
            ...(extraLegend.labels || {})
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: "#0a1d19",
          borderColor: "#426057",
          borderWidth: 1,
          titleColor: "#dce8e1",
          bodyColor: "#b8c9c1",
          padding: 10,
          cornerRadius: 6,
          displayColors: true,
          ...extraTooltip,
          callbacks: {
            ...(extraTooltip.callbacks || {})
          }
        }
      }
    }
  });
}

// INITIALIZATION

setView("dashboard");

searchPlaces("Tangub").then((results) => {
  if (results.length) {
    loadDashboard(results[0]);
  } else {
    showError("No location found for Tangub.");
  }
}).catch((err) => {
  showError("Initial location search failed: " + err.message);
});