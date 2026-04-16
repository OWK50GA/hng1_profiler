import { AgeGroup, Gender } from "./types";

const GENDERS = ['male', 'female'] as const;
const AGE_GROUPS = ['adult', 'child', 'teenager', 'senior'] as const;

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && GENDERS.includes(value.toLowerCase() as Gender);
}

export function isAgeGroup(value: unknown): value is AgeGroup {
  return typeof value === 'string' && AGE_GROUPS.includes(value.toLowerCase() as AgeGroup);
}