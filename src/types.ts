// The raw page as it comes from the database
export type RawPage = {
  id: number;
  path: string;
  slug: string;
  title: string;
  content: string;
  template: string;
  data: string;  // JSON string from DB
  published_date: string;
};

// The processed page after JSON parsing
export type Page = Omit<RawPage, 'data'> & {
  data: Record<string, any>;  // Parsed JSON object
};

export type TypeOfAsset = 'images' | 'css' | 'templates' | 'json';

export type RawAsset = {
  path: string;
  content: string;
  type: TypeOfAsset;
};
