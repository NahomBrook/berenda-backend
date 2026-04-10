export const sendResponse = (res: any, status: number, message: string, data?: any) => {
  res.status(status).json({
    success: status >= 200 && status < 300,
    status,
    message,
    data: data || null,
    timestamp: new Date().toISOString(),
  });
};