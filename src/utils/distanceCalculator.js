const RATES = [
  { maxDistance: 1, price: 30 },
  { maxDistance: 2, price: 40 },
  { maxDistance: 3, price: 50 },
  { maxDistance: 5, price: 60 },
  { maxDistance: 8, price: 70 },
  { maxDistance: Infinity, price: 80 }
];

const calculateDistance = (coords1, coords2) => {
  if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) {
    console.warn('⚠️ Coordenadas inválidas:', { coords1, coords2 });
    return 0;
  }

  const [lng1, lat1] = coords1;
  const [lng2, lat2] = coords2;

  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lng2 - lng1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return parseFloat(distance.toFixed(2));
};

const calculatePrice = (distance) => {
  for (const rate of RATES) {
    if (distance <= rate.maxDistance) {
      return rate.price;
    }
  }
  return 80;
};

module.exports = {
  calculateDistance,
  calculatePrice
};