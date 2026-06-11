import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/auth/me (GET) requires Firebase bearer token', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('/ai/status (GET) requires Firebase bearer token', () => {
    return request(app.getHttpServer()).get('/ai/status').expect(401);
  });

  it('/ai/live-token (POST) requires Firebase bearer token', () => {
    return request(app.getHttpServer()).post('/ai/live-token').expect(401);
  });
});
