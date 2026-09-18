import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity.js';

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City)
    private repo: Repository<City>,
  ) {}

  findAll(): Promise<City[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<City> {
    const city = await this.repo.findOne({ where: { id } });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  async create(data: Partial<City>): Promise<City> {
    const city = this.repo.create(data);
    return this.repo.save(city);
  }

  async update(id: string, data: Partial<City>): Promise<City> {
    const city = await this.findOne(id);
    Object.assign(city, data);
    return this.repo.save(city);
  }

  async remove(id: string): Promise<void> {
    const city = await this.findOne(id);
    await this.repo.remove(city);
  }
}
