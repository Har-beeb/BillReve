export const sendResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
) => ({
  success,
  message,
  data,
});
