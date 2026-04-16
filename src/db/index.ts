import { Pool, QueryResult, Result } from "pg";
import { config } from "dotenv";
import { AgeGroup, AllProfileQueryOptions, Classification, Gender } from "../types";

config();

/**
 * PostgreSQL database client for interactions
 */
export class DatabaseClient {
  private pool: Pool;

  constructor() {
    const dbUrl = process.env.CLASSIFY_DB_URL;

    if (!dbUrl) {
      throw new Error("CLASSIFY_DB_URL environment variable not set");
    }

    this.pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * 
   * @param record - record to add to classifications
   * @returns Promise<Classification> - Creared classifications entry
   * @throws Error if name already exists or database operation fails
   */
  async insertRecord(record: {
    id: string,
    name: string;
    gender: "male" | "female";
    gender_probability: number;
    sample_size: number;
    age: number;
    age_group: "adult" | "child" | "teenager" | "senior";
    country_id: string;
    country_probability: number;
  }): Promise<{
    classification: Classification,
    duplicate: boolean
  }> {
    const query = `
        INSERT INTO classifications (
            id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
        ) ON CONFLICT (LOWER(name)) DO NOTHING
        RETURNING id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at
    `;

    try {
      const result: QueryResult<Classification> = await this.pool.query(query, [
        record.id,
        record.name,
        record.gender,
        record.gender_probability,
        record.sample_size,
        record.age,
        record.age_group,
        record.country_id,
        record.country_probability,
      ]);

      if (result.rowCount && result.rowCount > 0) {
        return {
          classification: result.rows[0],
          duplicate: false
        };
      }

      const existing = await this.getRecordByName(record.name);
      if (!existing) {
        throw new Error("Unexpected state: name conflict but record not found")
      }
      return {
        classification: existing,
        duplicate: true
      };
    } catch (error: any) {
      if (error.code === "23505") {
        throw new Error("Name already exists");
      }
      throw error
    }
  }

  async getRecordByName(name: string): Promise<Classification | null> {
    // const normalizedName = name.toLowerCase().trim();

    const query = `
        SELECT id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at
        FROM classifications
        WHERE LOWER(name) = $1
    `;

    const result = await this.pool.query(query, [name.trim().toLowerCase()]);
    
    if (result.rowCount && result.rowCount > 0) {
      return result.rows[0];
    } else {
      return null
    }
  }

  /**
   * Find a classifications entry by name (case-insensitive)
   * @param id id to search for in table
   * @returns Promise<Classification | null>
   */
  async getRecord(id: string): Promise<Classification | null> {
    // const normalizedName = name.toLowerCase().trim();

    const query = `
        SELECT id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at
        FROM classifications
        WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    
    if (result.rowCount && result.rowCount > 0) {
      return result.rows[0];
    } else {
      return null
    }
  }

  async close(): Promise<void> {
    this.pool.end();
  }

  async getAllRecords(options: AllProfileQueryOptions): Promise<{
    records: Classification[],
    count: number
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.gender) {
      conditions.push(`gender = $${paramIndex}`);
      values.push(options.gender.toLowerCase());
      paramIndex++;
    }

    if (options.age_group) {
      conditions.push(`age_group = $${paramIndex}`);
      values.push(options.age_group.toLowerCase());
      paramIndex++;
    }

    if (options.country_id) {
      conditions.push(`LOWER(country_id) = $${paramIndex}`);
      values.push(options.country_id.toLowerCase());
      paramIndex++;
    }

    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = ' WHERE ' + conditions.join(' AND ');
    }

    const query = `
      SELECT id, name, gender, age, age_group, country_id
      FROM classifications
      ${whereClause}
      ORDER BY name ASC
    `;

    const result = await this.pool.query(query, values);

    return {
      records: result.rows,
      count: result.rowCount ?? 0
    };
  }

  async deleteRecord(id: string): Promise<boolean> {
    const query = `
      DELETE FROM classifications
      WHERE id = $1
    `;

    try {
      const result = await this.pool.query(query, [id]);

      if (result.rowCount === 0) {
        throw new Error(`Record with id "${id}" not found`);
      }
      return (result.rowCount ?? 0) > 0;
    } catch (err) {
      throw err
    }
  }
}
