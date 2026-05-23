# Shipment 出货单据功能需求

**状态**: 规划中  
**创建日期**: 2026-05-23  
**优先级**: 高

---

## 概述

引入 **Shipment（出货单据）** 层级，用于整合和追踪一次出货操作中的多个库存异动记录。

## 问题背景

现状问题：
- 普通产品出库只有备註信息，业务信息不足
- 无法追踪多个不同型号产品是否同时出货
- 无法关联客户、专案等业务信息到出货
- AP 产品与普通产品的出货记录信息结构不一致

## 设计原则

### 1. Transaction（库存异动）- 保持独立简洁

```json
{
  "id": 1,
  "product_id": 1,
  "sku": "SKU-001",
  "quantity_change": -5,
  "quantity_type": "accountable",
  "tag_id": 2,
  "tag_name": "OUTBOUND",
  "remarks": "出库",
  "operator_id": 5,
  "operator_name": "张三",
  "created_at": "2026-05-23T10:00:00Z"
}
```

**职责**：记录库存变动的核心数据 + 审计信息（谁、何时）

---

### 2. Shipment（出货单据）- 独立业务层

```json
{
  "id": 1,
  "shipment_number": "SHP-20260523-001",
  "customer": "客户A",
  "project_case": "案件编号",
  "transaction_ids": [101, 102, 103],
  "status": "pending|confirmed|shipped|delivered",
  
  "items_summary": [
    { "model": "X1", "product_count": 1, "quantity": 5 },
    { "model": "X2", "product_count": 1, "quantity": 3 },
    { "product_id": 10, "serial": "SN-12345" }
  ],
  
  "shipment_date": "2026-05-23",
  "created_at": "2026-05-23T10:00:00Z"
}
```

**职责**：组织出货业务，关联库存异动记录

---

## 关键约束

**一对多关系**：
- 一个 Shipment 包含多个 Transactions ✓
- 一个 Transaction 只能属于一个 Shipment ✓

**验证规则**（API 层面）：
1. 创建 Shipment 时，检查 transaction_ids 是否已被其他 Shipment 占用
2. 返回冲突错误，防止重复关联
3. 删除 Shipment 时，解除 transaction 关联

---

## API 设计

### 创建出货单

```
POST /api/shipments

Request:
{
  "transaction_ids": [101, 102, 103],
  "customer": "客户A",
  "project_case": "案件编号",
  "shipment_date": "2026-05-23"
}

Response (201):
{
  "success": true,
  "data": {
    "id": 1,
    "shipment_number": "SHP-20260523-001",
    "transaction_ids": [101, 102, 103],
    "customer": "客户A",
    "project_case": "案件编号",
    "status": "pending"
  }
}

Error (400 - 冲突):
{
  "success": false,
  "error": "Transaction 102 already belongs to shipment 5"
}
```

### 查询出货单详情

```
GET /api/shipments/:id

Response (200):
{
  "success": true,
  "data": {
    "id": 1,
    "shipment_number": "SHP-20260523-001",
    "customer": "客户A",
    "project_case": "案件编号",
    "transaction_ids": [101, 102, 103],
    "transactions": [
      {
        "id": 101,
        "product_id": 1,
        "sku": "SKU-001",
        "quantity_change": -5,
        "model": "X1"
      },
      ...
    ],
    "items_summary": [...],
    "status": "pending",
    "shipment_date": "2026-05-23"
  }
}
```

### 更新出货单状态

```
PUT /api/shipments/:id

Request:
{
  "status": "shipped",
  "shipped_date": "2026-05-24"
}
```

### 删除出货单

```
DELETE /api/shipments/:id

// 解除 transaction 关联，但 transaction 记录保留
```

---

## 实现步骤

- [ ] 创建 `Shipment` 数据模型/表结构
- [ ] 实现 Shipment API 端点（CRUD）
- [ ] 添加约束验证逻辑（事务隔离）
- [ ] 更新 `docs/api.md` 文档
- [ ] 编写单元测试 + 集成测试
- [ ] 前端界面：选择 transactions 创建 shipment

---

## 相关文档

- [API Reference - Transactions](./api.md#transactions-庫存異動)
- [Batch vs Shipment 的区别](./concepts.md) *(待创建)*
