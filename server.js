import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// TossPayments 결제위젯(v2) 공식 문서에 공개된 테스트 시크릿 키입니다. (실결제 불가, 샌드박스 전용)
const TOSS_SECRET_KEY = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 결제 승인(confirm) — 클라이언트에서 결제창을 통과한 후 서버가 최종 승인을 호출합니다.
app.post("/confirm", async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;

  try {
    const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64"),
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`쇼핑몰 서버 실행 중: http://localhost:${PORT}`);
});
