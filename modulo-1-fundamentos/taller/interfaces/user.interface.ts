export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  requestTimeout: number;
}
