export interface Environment {
    postgrestUrl: string,
    map: {
        tileUrl: string,
        attribution: string,
        defaultCenter: [number, number],  // [lat, lng]
        defaultZoom: number
    }
}