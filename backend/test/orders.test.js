import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import app from "../src/app.js";
import { ProductRepository } from "../src/repositories/ProductRepository.js";

let server, base, cookie, product;
const headers = { "Content-Type": "application/json" };

before(async () => {
  process.env.ADMIN_USERNAME = "pedidos-test";
  process.env.ADMIN_PASSWORD = "clave-segura-para-pedidos";
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(`${base}/admin/login`, {
    method: "POST", headers,
    body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
  });
  cookie = login.headers.get("set-cookie").split(";")[0];
  const response = await fetch(`${base}/products`, {
    method: "POST", headers: { ...headers, Cookie: cookie },
    body: JSON.stringify({ name: "Pedido de prueba", description: "Prueba", category: "Panadería", price: 2500, stock: 5 }),
  });
  product = (await response.json()).data;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const order = (overrides = {}) => ({
  requestId: randomUUID(), customerName: "Ana Pérez", phone: "1123456789",
  items: [{ productId: product.id, quantity: 2, expectedUnitPrice: 2500 }],
  ...overrides,
});
const submit = (body) => fetch(`${base}/orders`, { method: "POST", headers, body: JSON.stringify(body) });

test("valida datos, disponibilidad y precio sin modificar el stock", async () => {
  const invalid = [
    order({ customerName: " " }), order({ phone: "abc" }),
    order({ items: [] }), order({ items: [{ productId: product.id, quantity: -1, expectedUnitPrice: 2500 }] }),
    order({ items: [{ productId: product.id, quantity: 1, expectedUnitPrice: 2500 }, { productId: product.id, quantity: 1, expectedUnitPrice: 2500 }] }),
  ];
  for (const body of invalid) assert.equal((await submit(body)).status, 400);
  assert.equal((await submit(order({ items: [{ productId: 999999, quantity: 1, expectedUnitPrice: 2500 }] }))).status, 404);
  assert.equal((await submit(order({ items: [{ productId: product.id, quantity: 6, expectedUnitPrice: 2500 }] }))).status, 409);
  assert.equal((await submit(order({ items: [{ productId: product.id, quantity: 1, expectedUnitPrice: 100 }] }))).status, 409);
  assert.equal((await submit(order({ items: [
    { productId: product.id, quantity: 1, expectedUnitPrice: 2500 },
    { productId: 999999, quantity: 1, expectedUnitPrice: 2500 },
  ] }))).status, 404);
  await fetch(`${base}/products/${product.id}`, {
    method: "PUT", headers: { ...headers, Cookie: cookie }, body: JSON.stringify({ available: false }),
  });
  assert.equal((await submit(order())).status, 409);
  await fetch(`${base}/products/${product.id}`, {
    method: "PUT", headers: { ...headers, Cookie: cookie }, body: JSON.stringify({ available: true }),
  });
  assert.equal((await (await fetch(`${base}/products/${product.id}`)).json()).data.stock, 5);
  assert.equal((await fetch(`${base}/orders`)).status, 401);
});

test("confirma atómicamente, permite reintentar sin duplicar y persiste", async () => {
  const body = order();
  const first = await submit(body);
  assert.equal(first.status, 201);
  const receipt = (await first.json()).data;
  assert.equal(receipt.total, 5000);
  const second = await submit(body);
  assert.deepEqual((await second.json()).data, receipt);
  assert.equal((await submit({ ...body, phone: "1199999999" })).status, 409);
  assert.equal((await (await fetch(`${base}/products/${product.id}`)).json()).data.stock, 3);
  const listed = await fetch(`${base}/orders`, { headers: { Cookie: cookie } });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).data.length, 1);
  const reopened = new ProductRepository(process.env.PRODUCTS_FILE);
  assert.equal(reopened.getById(product.id).stock, 3);
  assert.equal(reopened.getOrders()[0].id, receipt.id);
});

test("dos pedidos simultáneos no pueden superar el stock restante", async () => {
  const responses = await Promise.all([submit(order()), submit(order())]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal((await (await fetch(`${base}/products/${product.id}`)).json()).data.stock, 1);
});

test("una falla al guardar no modifica el stock ni registra el pedido en memoria", () => {
  const repository = new ProductRepository(process.env.PRODUCTS_FILE);
  const before = repository.getById(product.id).stock;
  const orders = repository.getOrders().length;
  repository.persist = () => { throw new Error("Disco no disponible"); };
  assert.throws(() => repository.saveOrder({ id: "prueba" }, []), /Disco no disponible/);
  assert.equal(repository.getById(product.id).stock, before);
  assert.equal(repository.getOrders().length, orders);
});

test("redondea el precio por unidad antes de calcular el total", async () => {
  const response = await fetch(`${base}/products`, {
    method: "POST", headers: { ...headers, Cookie: cookie },
    body: JSON.stringify({ name: "Precio decimal", description: "Prueba", category: "Panadería", price: 1.005, stock: 3 }),
  });
  const decimalProduct = (await response.json()).data;
  const result = await submit(order({ items: [{ productId: decimalProduct.id, quantity: 2, expectedUnitPrice: 1.005 }] }));
  assert.equal(result.status, 201);
  const receipt = (await result.json()).data;
  assert.equal(receipt.items[0].unitPrice, 1.01);
  assert.equal(receipt.total, 2.02);
});
