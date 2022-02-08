import axios, {
  AxiosError,
  AxiosRequestConfig,
} from "axios";

export function request<T>(config: AxiosRequestConfig) {
  return (
    axios
      .request<T>(config)
      .then(({ data }) => data)
      .catch((err: AxiosError<T>) => err.response?.data ?? null)
  );
}

export function get<T>(url: string, config: AxiosRequestConfig = {}) {
  return request<T>({
    ...config,
    url,
    method: "GET",
  });
}

export function post<T>(url: string, data: unknown = undefined, config: AxiosRequestConfig = {}) {
  return request<T>({
    headers: {
      "Content-Type": "application/json",
    },
    ...config,
    url,
    method: "POST",
    data,
  });
}
