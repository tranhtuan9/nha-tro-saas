import http from 'http';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

interface LatencyStats {
  count: number;
  errors: number;
  totalTimeSec: number;
  reqPerSec: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

function calculateStats(latencies: number[], errors: number, totalTimeMs: number): LatencyStats {
  latencies.sort((a, b) => a - b);
  const count = latencies.length;
  const total = latencies.reduce((sum, v) => sum + v, 0);
  const p = (pct: number) => {
    if (count === 0) return 0;
    const idx = Math.min(Math.floor((pct / 100) * count), count - 1);
    return latencies[idx];
  };

  const totalTimeSec = totalTimeMs / 1000;
  return {
    count,
    errors,
    totalTimeSec: Number(totalTimeSec.toFixed(2)),
    reqPerSec: Number((count / totalTimeSec).toFixed(1)),
    minMs: count > 0 ? Number(latencies[0].toFixed(1)) : 0,
    maxMs: count > 0 ? Number(latencies[count - 1].toFixed(1)) : 0,
    avgMs: count > 0 ? Number((total / count).toFixed(1)) : 0,
    p50Ms: Number(p(50).toFixed(1)),
    p90Ms: Number(p(90).toFixed(1)),
    p95Ms: Number(p(95).toFixed(1)),
    p99Ms: Number(p(99).toFixed(1)),
  };
}

async function runLoadTest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  totalRequests: number,
  concurrency: number
): Promise<LatencyStats> {
  const latencies: number[] = [];
  let errors = 0;
  let sent = 0;
  const startTime = Date.now();

  async function worker() {
    while (true) {
      const idx = sent++;
      if (idx >= totalRequests) break;

      const reqStart = performance.now();
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body || undefined,
        });
        const duration = performance.now() - reqStart;
        if (res.ok) {
          latencies.push(duration);
        } else {
          errors++;
        }
        await res.text();
      } catch (err) {
        errors++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTimeMs = Date.now() - startTime;
  return calculateStats(latencies, errors, totalTimeMs);
}

async function main() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TẢI & ĐO LƯỜNG HIỆU NĂNG (LOAD TEST) ===\n');

  // 1. Tạo test landlord và token
  const plan = await prismaSystem.plan.findFirstOrThrow({ where: { name: 'Cơ bản' } });
  const tenant = await prismaSystem.tenant.create({
    data: {
      name: 'Nhà Trọ LoadTest Benchmark',
      planId: plan.id,
      status: 'ACTIVE',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 30 * 86400000),
    },
  });

  const passwordHash = await bcrypt.hash('Benchmark@123', 8);
  const landlordUser = await prismaSystem.user.create({
    data: {
      email: `benchmark.${Date.now()}@example.com`,
      passwordHash,
      fullName: 'Chủ Trọ Benchmark',
      role: 'LANDLORD',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  // Tạo 5 phòng để test đọc dữ liệu
  const property = await prismaSystem.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Khu Nhà Trọ Thử Nghiệm',
      address: '123 Đường Thử Nghiệm',
      electricityUnitPrice: 3500,
      waterUnitPrice: 20000,
    },
  });

  for (let i = 1; i <= 5; i++) {
    await prismaSystem.room.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        roomCode: `P${100 + i}`,
        basePrice: 3000000,
        areaM2: 25,
        status: 'AVAILABLE',
      },
    });
  }

  const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
  const token = jwt.sign(
    {
      userId: landlordUser.id,
      tenantId: tenant.id,
      role: 'LANDLORD',
      email: landlordUser.email,
    },
    jwtSecret,
    { expiresIn: '1h' }
  );

  // 2. Khởi động server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`✓ Server benchmark đã chạy tại ${baseUrl}\n`);

  // Scenario 1: Đọc danh sách phòng (RLS Query)
  console.log('Đang chạy Kịch bản 1: GET /api/rooms (Truy vấn CSDL có PostgreSQL RLS)...');
  const roomsStats = await runLoadTest(
    `${baseUrl}/api/rooms`,
    'GET',
    { Authorization: `Bearer ${token}` },
    null,
    300,
    30
  );

  // Scenario 2: Đọc danh sách hóa đơn (RLS Invoice query)
  console.log('Đang chạy Kịch bản 2: GET /api/invoices (Truy vấn hóa đơn đa bảng có RLS)...');
  const invoiceStats = await runLoadTest(
    `${baseUrl}/api/invoices`,
    'GET',
    { Authorization: `Bearer ${token}` },
    null,
    300,
    30
  );

  // Scenario 3: Đăng nhập (CPU Intensive Bcrypt password verify - 5 reqs để trong ngưỡng an toàn rate limit 10 req/15 phút)
  console.log('Đang chạy Kịch bản 3: POST /api/auth/login (Xác thực Bcrypt mật khẩu)...');
  const loginStats = await runLoadTest(
    `${baseUrl}/api/auth/login`,
    'POST',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ email: landlordUser.email, password: 'Benchmark@123' }),
    5,
    5
  );

  // Scenario 4: Đọc danh sách dịch vụ (Services list)
  console.log('Đang chạy Kịch bản 4: GET /api/services (Truy vấn bảng dịch vụ)...');
  const serviceStats = await runLoadTest(
    `${baseUrl}/api/services`,
    'GET',
    { Authorization: `Bearer ${token}` },
    null,
    300,
    30
  );

  // Dọn dẹp
  server.close();
  await prismaSystem.room.deleteMany({ where: { tenantId: tenant.id } });
  await prismaSystem.property.deleteMany({ where: { tenantId: tenant.id } });
  await prismaSystem.user.delete({ where: { id: landlordUser.id } });
  await prismaSystem.tenant.delete({ where: { id: tenant.id } });

  console.log('\n=== KẾT QUẢ ĐO LƯỜNG HIỆU NĂNG HỆ THỐNG (LOAD TEST SUMMARY) ===\n');
  console.log('| Kịch bản kiểm thử (API Endpoint) | Tổng Requests | Đồng thời (Concurrency) | Thông lượng (Req/s) | Độ trễ TB (Avg) | Độ trễ p50 (Median) | Độ trễ p95 | Độ trễ p99 | Tỷ lệ lỗi |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');
  
  const printRow = (name: string, c: number, s: LatencyStats) => {
    const errRate = ((s.errors / (s.count + s.errors)) * 100).toFixed(2) + '%';
    console.log(
      `| ${name} | ${s.count} | ${c} | ${s.reqPerSec} req/s | ${s.avgMs} ms | ${s.p50Ms} ms | ${s.p95Ms} ms | ${s.p99Ms} ms | ${errRate} |`
    );
  };

  printRow('`GET /api/rooms` (RLS Query)', 30, roomsStats);
  printRow('`GET /api/invoices` (RLS Query)', 30, invoiceStats);
  printRow('`GET /api/services` (Dịch vụ)', 30, serviceStats);
  printRow('`POST /api/auth/login` (Bcrypt Hash)', 10, loginStats);

  console.log('\n=== HOÀN TẤT ĐO ĐẠC TOÀN DIỆN ===');
}

main().catch(console.error);
