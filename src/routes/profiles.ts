import { Router, type Request, type Response } from "express";
import { AgeGroup, AgifyAPIResponse, AllProfileQueryOptions, Gender, GenderizeAPIResponse, NationalizeAPIResponse } from "../types";
import { DatabaseClient } from "../db";
import * as uuid from 'uuid';
import { isAgeGroup, isGender } from "../utils";

const router = Router();
const dbClient = new DatabaseClient();
router.post("/", async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({
            status: "error",
            message: "Missing name in request body"
        })
    }
    console.log(name);

    // This shouldn't be the only 422 case though
    if (typeof name !== 'string') {
        return res.status(422).json({
            status: "error",
            message: "Unprocessable entity"
        })
    }

    try {
        const genderizeRes = await fetch(`https://api.genderize.io?name=${name}`);
        const nationalizeRes = await fetch(`https://api.nationalize.io/?name=${name}`);
        const agifyRes = await fetch(`https://api.agify.io/?name=${name}`);

        if (!genderizeRes.ok) {
            return res.status(502).json({
                status: "error",
                message: "Genderize returned an invalid response"
            })
        }

        if (!agifyRes.ok) {
            return res.status(502).json({
                status: "error",
                message: "Agify returned an invalid response"
            })
        }

        if (!nationalizeRes.ok) {
            return res.status(502).json({
                status: "error",
                message: "Nationalize returned an invalid response"
            })
        }

        const { count: sample_size, probability: gender_probability, gender }: GenderizeAPIResponse = await genderizeRes.json();

        if (gender === null || sample_size === 0) {
            return res.status(502).json({
                status: "error",
                message: "Genderize returned an invalid response"
            })
        };

        const { age }: AgifyAPIResponse = await agifyRes.json();

        if (age === null || age < 0) {
            return res.status(502).json({
                status: "error",
                message: "Agify returned an invalid response"
            });
        }

        const { country }: NationalizeAPIResponse = await nationalizeRes.json();

        const age_group: AgeGroup = age <= 12 ? "child" : age <= 19 ? "teenager" : age <= 59 ? "adult" : "senior";

        if (!country || country.length === 0 ) {
            return res.status(502).json({
                status: "error",
                message: "Nationalize returned an invalid response"
            })
        }

        const topCountry = country.sort((a, b) => b.probability - a.probability)[0];

        const record = {
            id: uuid.v7(),
            name,
            gender,
            gender_probability,
            sample_size,
            age,
            age_group,
            country_id: topCountry.country_id,
            country_probability: topCountry.probability,
        }
        
        const { classification, duplicate } = await dbClient.insertRecord(record);
        console.log("Classification: ", classification);

        if (duplicate) {
            return res.status(200).json({
                status: "success",
                message: "Profile already exists",
                data: classification
            })
        } else {
            return res.status(201).json({
                status: "success",
                data: classification
            })
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        })
    }
})

router.get("/", async (req: Request, res: Response) => {
    const { gender, country_id, age_group } = req.query;

    const options: AllProfileQueryOptions = {};

    if (gender && typeof gender === 'string' && isGender(gender)) {
        options.gender = gender;
    }
    if (country_id && typeof country_id === 'string') {
        options.country_id = country_id;
    }
    if (age_group && typeof age_group === 'string' && isAgeGroup(age_group)) {
        options.age_group = age_group;
    }
    
    try {
        const { count, records } = await dbClient.getAllRecords(options);
        return res.status(200).json({
            status: "success",
            count,
            data: records
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
})

router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(id);

    if (!id) {
        return res.status(400).json({
            status: "error",
            message: "Missing name request param"
        });
    }

    if (typeof id !== 'string') {
        return res.status(422).json({
            status: "error",
            message: "Unprocessable entity"
        });
    }

    try {
        const record = await dbClient.getRecord(id);
    
        if (!record || record === null || typeof record === 'undefined') {
            return res.status(404).json({
                status: "error",
                message: `Record for ${id} does not exist`
            })
        }
        // const dbClient = new DatabaseClient();
    
        return res.status(200).json({
            status: "success",
            data: record
        })
    } catch (err) {
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        })
    }
})

router.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(id);

    if (!id) {
        return res.status(400).json({
            status: "error",
            message: "Missing id request param"
        });
    }

    if (typeof id !== 'string') {
        return res.status(422).json({
            status: "error",
            message: "Unprocessable entity"
        });
    }

    try {
        await dbClient.deleteRecord(id);
        res.status(204).send();
    } catch (err) {
         if ((err as Error).message.includes('not found')) {
            res.status(404).json({ status: "error", message: (err as Error).message });
        } else {
            res.status(500).json({ status: "error", message: 'Internal server error' });
        }
    }
})

export default router;