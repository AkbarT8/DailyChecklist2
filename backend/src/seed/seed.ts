import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'app_db',
    entities: [UserEntity],
    synchronize: true,
  });

  await ds.initialize();
  const repo = ds.getRepository(UserEntity);

  const adminEmail = 'admin@example.com';
  let admin = await repo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = repo.create({
      email: adminEmail,
      password: await bcrypt.hash('admin123', 10),
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    });
    await repo.save(admin);
    console.log('Created admin@example.com / admin123');
  } else {
    console.log('Admin user already exists');
  }

  await ds.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
