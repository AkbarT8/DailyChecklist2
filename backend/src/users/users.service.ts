import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  private toSafeUser(user: UserEntity): SafeUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
    return users.map((u) => this.toSafeUser(u));
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.toSafeUser(user);
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const user = this.usersRepo.create({
      email,
      password: await bcrypt.hash(dto.password, 10),
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      role: dto.role?.trim() || 'user',
    });
    const saved = await this.usersRepo.save(user);
    return this.toSafeUser(saved);
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.usersRepo.findOne({ where: { email } });
      if (existing && existing.id !== id) throw new ConflictException('Email already in use');
      user.email = email;
    }
    if (dto.firstName !== undefined) user.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) user.lastName = dto.lastName.trim();
    if (dto.role !== undefined) user.role = dto.role.trim();
    if (dto.password) user.password = await bcrypt.hash(dto.password, 10);

    const saved = await this.usersRepo.save(user);
    return this.toSafeUser(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepo.delete(id);
    if (!result.affected) throw new NotFoundException('User not found');
  }
}
