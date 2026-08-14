import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { status: 'ok'; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'career-compass-api',
      timestamp: new Date().toISOString(),
    };
  }
}
