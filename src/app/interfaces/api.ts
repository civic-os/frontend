export interface ApiResponse {
    success: boolean;
    error?: ApiError;
    body?: any;
}
export interface ApiError {
    httpCode?: number;
    code?: string;
    details?: string;
    hint?: string;
    humanMessage: string;
    message: string;
}