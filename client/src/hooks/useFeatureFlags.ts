export const useFeatureFlags = () => {
  return {
    enableCsvImport: import.meta.env.VITE_ENABLE_CSV_IMPORT === 'true',
    enableMockData: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true'
  };
};
