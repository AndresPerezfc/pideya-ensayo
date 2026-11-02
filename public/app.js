// App del estudiante: menú, carrito y estado del pedido.
// Relevo 1 (Frontend).

// Máximo de productos por pedido (contrato.md). Cada unidad cuenta como un producto.
const MAXIMO_PRODUCTOS = 5;
// Cada cuánto se pregunta por el estado del pedido: 5 segundos.
const ESPERA_ESTADO = 5000;
// Cómo se le muestra a la persona cada estado del contrato.
const ESTADOS = {
  recibido: "Recibido",
  preparando: "En preparación",
  listo: "¡Listo para recoger!",
  entregado: "Entregado",
};

let menu = [];
// Mientras se envía el pedido no se puede cambiar el carrito ni pedir otra vez.
let enviando = false;
// El carrito guarda cuántas unidades se llevan de cada producto: { idProducto: cantidad }
const carrito = {};

// Habla con la API y devuelve la respuesta ya convertida desde JSON.
// Si la API responde con error, lanza un Error con el mensaje que mandó el servidor.
async function api(ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      headers: { "Content-Type": "application/json", ...(opciones.headers || {}) },
    });
  } catch {
    throw new Error("No pudimos conectarnos con la cafetería. Revisa tu conexión e intenta de nuevo.");
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || `Error ${respuesta.status}`);
  return datos;
}

// Formato de pesos colombianos: 3500 → "$3.500"
function pesos(valor) {
  return "$" + Number(valor).toLocaleString("es-CO");
}

// Crea una etiqueta con su clase y su texto.
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  elemento.textContent = texto;
  return elemento;
}

function cantidadEnCarrito(id) {
  return carrito[id] || 0;
}

function totalProductos() {
  return Object.values(carrito).reduce((suma, cantidad) => suma + cantidad, 0);
}

function totalPesos() {
  return menu.reduce((suma, producto) => suma + producto.precio * cantidadEnCarrito(producto.id), 0);
}

// Solo se puede agregar si hay cupo en el pedido y quedan unidades del producto.
function sePuedeAgregar(producto) {
  return !enviando && totalProductos() < MAXIMO_PRODUCTOS && cantidadEnCarrito(producto.id) < producto.stock;
}

function agregar(producto) {
  if (!sePuedeAgregar(producto)) return;
  carrito[producto.id] = cantidadEnCarrito(producto.id) + 1;
  mostrarError("");
  actualizarCarrito();
}

function crearTarjeta(producto) {
  const agotado = producto.stock <= 0;
  const tarjeta = crear("article", agotado ? "tarjeta agotado" : "tarjeta", "");

  const info = crear("div", "tarjeta-info", "");
  info.append(crear("h3", "tarjeta-nombre", producto.nombre));
  info.append(crear("p", "tarjeta-precio", pesos(producto.precio)));
  tarjeta.append(info);

  if (agotado) {
    tarjeta.append(crear("span", "etiqueta-agotado", "Agotado"));
  } else {
    const boton = crear("button", "boton-agregar", "Agregar");
    boton.type = "button";
    boton.dataset.id = producto.id;
    boton.setAttribute("aria-label", `Agregar ${producto.nombre}`);
    boton.addEventListener("click", () => agregar(producto));
    tarjeta.append(boton);
  }
  return tarjeta;
}

function mostrarMenu() {
  const contenedor = document.getElementById("menu");
  if (menu.length === 0) {
    contenedor.replaceChildren(crear("p", "aviso", "Hoy no hay productos en el menú."));
    return;
  }
  contenedor.replaceChildren(...menu.map(crearTarjeta));
}

function actualizarCarrito() {
  const cantidad = totalProductos();
  document.getElementById("carrito-cantidad").textContent = `${cantidad} de ${MAXIMO_PRODUCTOS} productos`;
  document.getElementById("carrito-total").textContent = pesos(totalPesos());
  document.getElementById("carrito-limite").hidden = cantidad < MAXIMO_PRODUCTOS;

  // Apaga los botones de lo que ya no se puede agregar.
  for (const producto of menu) {
    const boton = document.querySelector(`.boton-agregar[data-id="${producto.id}"]`);
    if (boton) boton.disabled = !sePuedeAgregar(producto);
  }

  const botonPedir = document.getElementById("boton-pedir");
  botonPedir.disabled = enviando || cantidad === 0;
  botonPedir.textContent = enviando ? "Enviando…" : "Pedir";
}

// Muestra un mensaje de error en el carrito. Con un texto vacío, lo quita.
function mostrarError(mensaje) {
  const error = document.getElementById("carrito-error");
  error.textContent = mensaje;
  error.hidden = !mensaje;
}

// Convierte el carrito en la lista de productos que pide contrato.md.
function itemsDelPedido() {
  return menu
    .filter((producto) => cantidadEnCarrito(producto.id) > 0)
    .map((producto) => ({
      productoId: producto.id,
      cantidad: cantidadEnCarrito(producto.id),
      precio: producto.precio,
    }));
}

async function enviarPedido(evento) {
  evento.preventDefault();
  if (enviando || totalProductos() === 0) return;

  const campoNombre = document.getElementById("nombre");
  const nombre = campoNombre.value.trim();
  if (!nombre) {
    mostrarError("Escribe tu nombre para hacer el pedido.");
    campoNombre.focus();
    return;
  }

  enviando = true;
  mostrarError("");
  actualizarCarrito();
  try {
    const pedido = await api("/api/pedidos", {
      method: "POST",
      body: JSON.stringify({ nombre, items: itemsDelPedido() }),
    });
    mostrarPantallaPedido(pedido);
  } catch (error) {
    mostrarError(error.message);
  } finally {
    enviando = false;
    actualizarCarrito();
  }
}

// Cambia del menú a la pantalla con el código de recogida.
function mostrarPantallaPedido(pedido) {
  document.querySelector("main").hidden = true;
  document.querySelector(".carrito").hidden = true;
  document.getElementById("pedido-codigo").textContent = pedido.codigo;
  document.getElementById("pedido-total").textContent = pesos(pedido.total);
  // Todo pedido empieza en "recibido" mientras llega la primera respuesta.
  mostrarEstado("recibido");
  document.getElementById("pantalla-pedido").hidden = false;
  document.getElementById("pedido-titulo").focus();
  seguirPedido(pedido.id);
}

function mostrarEstado(estado) {
  const elemento = document.getElementById("pedido-estado");
  elemento.textContent = ESTADOS[estado] || estado;
  elemento.dataset.estado = estado;
}

// Pregunta el estado cada 5 segundos hasta que el pedido se entrega.
async function seguirPedido(id) {
  const aviso = document.getElementById("pedido-aviso");
  try {
    const pedido = await api(`/api/pedidos/${id}`);
    mostrarEstado(pedido.estado);
    aviso.hidden = true;
    if (pedido.estado === "entregado") return;
  } catch {
    // Si falla una consulta, se conserva el último estado y se intenta otra vez.
    aviso.hidden = false;
  }
  setTimeout(() => seguirPedido(id), ESPERA_ESTADO);
}

async function cargarMenu() {
  try {
    menu = await api("/api/menu");
    mostrarMenu();
    actualizarCarrito();
  } catch (error) {
    document.getElementById("menu").replaceChildren(
      crear("p", "aviso", "No pudimos cargar el menú. Revisa tu conexión y recarga la página.")
    );
  }
}

document.getElementById("form-pedido").addEventListener("submit", enviarPedido);
cargarMenu();
