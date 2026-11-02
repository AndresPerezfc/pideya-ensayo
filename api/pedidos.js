// Pedidos de los estudiantes: POST /api/pedidos y GET /api/pedidos/:id (ver contrato.md).
// Se construye en el relevo 3 (Backend).

const { Router } = require("express");
const datos = require("../db/datos");

const router = Router();

// POST /api/pedidos: recibe un pedido nuevo.
router.post("/", async (req, res) => {
  const { nombre, items } = req.body ?? {};

  if (typeof nombre !== "string" || nombre.trim() === "") {
    return res.status(400).json({ error: "Escribe tu nombre para hacer el pedido." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Tu pedido debe tener al menos 1 producto." });
  }
  if (items.length > 5) {
    return res.status(400).json({ error: "Tu pedido puede tener máximo 5 productos." });
  }
  const itemsBien = items.every(item =>
    Number.isInteger(item?.productoId) &&
    Number.isInteger(item?.cantidad) && item.cantidad > 0 &&
    Number.isInteger(item?.precio) && item.precio >= 0
  );
  if (!itemsBien) {
    return res.status(400).json({ error: "Revisa tu pedido: algún producto tiene datos inválidos." });
  }

  // Si no hay unidades o el producto no existe, crearPedido lanza un error
  // que server.js convierte en una respuesta 400 con su mensaje.
  const pedido = await datos.crearPedido({ nombre: nombre.trim(), items });
  res.status(201).json(pedido);
});

// GET /api/pedidos/:id: estado de un pedido.
router.get("/:id", (req, res) => {
  res.status(501).json({ error: "Todavía no se puede consultar un pedido. Se construye en el relevo de Backend." });
});

module.exports = router;
