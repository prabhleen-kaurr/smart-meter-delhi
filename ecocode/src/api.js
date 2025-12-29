
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * @param {string}
 * @returns {Promise<object>} 
 */
export const fetchForecast = async (zoneId) => {
  if (!BACKEND_URL) {
    throw new Error("REACT_APP_BACKEND_URL is not set in client/.env");
  }

  const url = `${BACKEND_URL}/api/forecast/${zoneId}`;

  try {
    const startTime = performance.now();
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const endTime = performance.now(); 

    data.actualPredictionTime = (endTime - startTime).toFixed(2); 

    return data;
    
  } catch (error) {
    console.error("Error fetching forecast:", error);
    return { error: true, message: error.message };
  }
};