export type NationalizeAPIResponse = {
  count: number;
  name: string;
  country: {
    country_id: string;
    probability: number;
  }[];
};

export type Gender = "male" | "female"

export type GenderizeAPIResponse = {
  count: number;
  name: string;
  gender: Gender | null;
  probability: number;
};

export type AgifyAPIResponse = {
  count: number;
  name: string;
  age: number | null;
};

export type AgeGroup = "adult" | "child" | "teenager" | "senior"

export type Classification = {
  id: string;
  name: string;
  gender: "male" | "female";
  gender_probability: number;
  sample_size: number;
  age: number;
  age_group: AgeGroup;
  country_id: string;
  country_probability: number;
  created_at: Date;
};

export type AllProfileQueryOptions = {
    gender?: Gender, 
    age_group?: AgeGroup, 
    country_id?: string
  }