export const sendResponse = (res: any, status: number, message: string, data?: any) => {
  res.status(status).json({
    status,
    message,
    data: data || null,
    timestamp: new Date().toISOString(),
  });
};