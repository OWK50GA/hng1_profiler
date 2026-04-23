import { Router, type Request, type Response } from "express";
import {
  AgeGroup,
  AgifyAPIResponse,
  AllProfileQueryOptions,
  GenderizeAPIResponse,
  NationalizeAPIResponse,
} from "../types";
import { DatabaseClient } from "../db";
import * as uuid from "uuid";
import { analyzeNaturalLanguageQuery, countryMap, isAgeGroup, isGender, isSortField, isSortOrder } from "../utils";

const router = Router();
const dbClient = new DatabaseClient();
router.post("/", async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({
      status: "error",
      message: "Missing name in request body",
    });
  }
  console.log(name);

  // This shouldn't be the only 422 case though
  if (typeof name !== "string") {
    return res.status(422).json({
      status: "error",
      message: "Unprocessable entity",
    });
  }

  try {
    const genderizeRes = await fetch(`https://api.genderize.io?name=${name}`);
    const nationalizeRes = await fetch(
      `https://api.nationalize.io/?name=${name}`,
    );
    const agifyRes = await fetch(`https://api.agify.io/?name=${name}`);

    if (!genderizeRes.ok) {
      return res.status(502).json({
        status: "error",
        message: "Genderize returned an invalid response",
      });
    }

    if (!agifyRes.ok) {
      return res.status(502).json({
        status: "error",
        message: "Agify returned an invalid response",
      });
    }

    if (!nationalizeRes.ok) {
      return res.status(502).json({
        status: "error",
        message: "Nationalize returned an invalid response",
      });
    }

    const {
      count: sample_size,
      probability: gender_probability,
      gender,
    }: GenderizeAPIResponse = await genderizeRes.json();

    if (gender === null || sample_size === 0) {
      return res.status(502).json({
        status: "error",
        message: "Genderize returned an invalid response",
      });
    }

    const { age }: AgifyAPIResponse = await agifyRes.json();

    if (age === null || age < 0) {
      return res.status(502).json({
        status: "error",
        message: "Agify returned an invalid response",
      });
    }

    const { country }: NationalizeAPIResponse = await nationalizeRes.json();

    const age_group: AgeGroup =
      age <= 12
        ? "child"
        : age <= 19
          ? "teenager"
          : age <= 59
            ? "adult"
            : "senior";

    if (!country || country.length === 0) {
      return res.status(502).json({
        status: "error",
        message: "Nationalize returned an invalid response",
      });
    }

    const topCountry = country.sort((a, b) => b.probability - a.probability)[0];
    const topCountryId = topCountry.country_id;

    const country_name = countryMap.get(topCountryId);

    if (!country_name) {
      return res.status(502).json({
        status: "error",
        message: "Nationalize returned an Invalid response"
      });
    }

    const record = {
      id: uuid.v7(),
      name,
      gender,
      gender_probability,
      // sample_size,
      age,
      age_group,
      country_id: topCountry.country_id,
      country_name,
      country_probability: topCountry.probability,
    };

    const { classification, duplicate } = await dbClient.insertRecord(record);
    console.log("Classification: ", classification);

    if (duplicate) {
      return res.status(200).json({
        status: "success",
        message: "Profile already exists",
        data: classification,
      });
    } else {
      return res.status(201).json({
        status: "success",
        data: classification,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

router.get("/", async (req: Request, res: Response) => {
  const { gender, country_id, age_group, min_age, max_age, min_gender_probability, min_country_probability, sort_by, order, page, limit } = req.query;

  const options: AllProfileQueryOptions = {};

  if (gender && typeof gender === "string" && isGender(gender)) {
    options.gender = gender;
  }
  if (country_id && typeof country_id === "string") {
    options.country_id = country_id;
  }
  if (age_group && typeof age_group === "string" && isAgeGroup(age_group)) {
    options.age_group = age_group;
  }
  if (min_age && typeof min_age === 'string') {
    options.min_age = parseInt(min_age);
  }
  if (max_age && typeof max_age === 'string') {
    options.max_age = parseInt(max_age);
  }
  if (min_gender_probability && typeof min_gender_probability === 'string') {
    options.min_gender_probability = parseFloat(min_gender_probability);
  }
  if (min_country_probability && typeof min_country_probability === 'string') {
    options.min_country_probability = parseFloat(min_country_probability);
  }
  if (sort_by && typeof sort_by === 'string' && isSortField(sort_by)) {
    options.sort_by = sort_by;
  }

  if (order && typeof order === 'string' && isSortOrder(order)) {
    options.sort_order = order;
  }

  if (page && typeof page === 'string') {
    options.page = parseInt(page);
  }

  if (limit && typeof limit === 'string') {
    options.limit = parseInt(limit);
  }

  try {
    const { page, limit, total, records } = await dbClient.getAllRecords(options);
    return res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      status: "error",
      message: "Missing or invalid query"
    });
  }

  const options = analyzeNaturalLanguageQuery(q);

  if (!options) {
    return res.status(422).json({
      status: 'error',
      message: 'Unable to interpret query'
    });
  }

  try {
    const { page, limit, total, records } = await dbClient.getAllRecords(options);
    return res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
})

router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log(id);

  if (!id) {
    return res.status(400).json({
      status: "error",
      message: "Missing name request param",
    });
  }

  if (typeof id !== "string") {
    return res.status(422).json({
      status: "error",
      message: "Unprocessable entity",
    });
  }

  try {
    const record = await dbClient.getRecord(id);

    if (!record || record === null || typeof record === "undefined") {
      return res.status(404).json({
        status: "error",
        message: `Record for ${id} does not exist`,
      });
    }
    // const dbClient = new DatabaseClient();

    return res.status(200).json({
      status: "success",
      data: record,
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log(id);

  if (!id) {
    return res.status(400).json({
      status: "error",
      message: "Missing id request param",
    });
  }

  if (typeof id !== "string") {
    return res.status(422).json({
      status: "error",
      message: "Unprocessable entity",
    });
  }

  try {
    await dbClient.deleteRecord(id);
    res.status(204).send();
  } catch (err) {
    if ((err as Error).message.includes("not found")) {
      res
        .status(404)
        .json({ status: "error", message: (err as Error).message });
    } else {
      res
        .status(500)
        .json({ status: "error", message: "Internal server error" });
    }
  }
});

export default router;
