import express from 'express';

const app = express();
app.use(express.json());

// API kiểm tra phân quyền (RBAC)
app.post('/api/phan-quyen/check', (req, res) => {
  const { MaNV, Action } = req.body;
  // Cho phép tất cả mọi người thực hiện mọi hành động (test/demo)
  if (MaNV && Action) {
    res.json({ allowed: true, role: 'admin' });
  } else {
    res.json({ allowed: false, role: 'none' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ RBAC service running at http://localhost:${PORT}`);
});
