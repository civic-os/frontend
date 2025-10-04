import { Environment } from "../app/interfaces/environment";

export const environment: Environment = {
    postgrestUrl: '',
    map: {
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        defaultCenter: [43.0125, -83.6875],  // Flint, MI
        defaultZoom: 13
    }
};
