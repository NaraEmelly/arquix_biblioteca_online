/* ================================
   CONFIG DO BACKEND
================================ */
const API_URL = "http://localhost:5000/api";
// ajuste caso o backend rode em outro local

/* ================================
   FUNÇÃO: MOSTRAR MENSAGENS
================================ */
function showMessage(msg, type = "info") {
  const box = document.createElement("div");
  box.classList.add("alert", type);
  box.textContent = msg;

  document.body.appendChild(box);

  setTimeout(() => {
    box.classList.add("hide");
    setTimeout(() => box.remove(), 300);
  }, 3000);
}

/* ================================
   VALIDAÇÃO SIMPLES DE FORMULÁRIOS
================================ */
function validateForm(fields) {
  for (let f of fields) {
    if (!f.value.trim()) {
      showMessage("Preencha todos os campos!", "error");
      return false;
    }
  }
  return true;
}

/* ================================
   LOGIN
================================ */
async function loginUser(event) {
  event.preventDefault();

  const email = document.querySelector("#email");
  const senha = document.querySelector("#senha");

  if (!validateForm([email, senha])) return;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value.trim(),
        senha: senha.value.trim()
      })
    });

    const data = await res.json();

    if (!data.ok) {
      showMessage(data.msg, "error");
      return;
    }

    showMessage("Login realizado!", "success");
    setTimeout(() => window.location.href = "dashboard.html", 500);

  } catch (err) {
    showMessage("Erro ao conectar ao servidor.", "error");
    console.error(err);
  }
}

/* ================================
   CADASTRO
================================ */
async function registerUser(event) {
  event.preventDefault();

  const nome = document.querySelector("#nome");
  const email = document.querySelector("#cad-email");
  const senha = document.querySelector("#cad-senha");

  if (!validateForm([nome, email, senha])) return;

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nome.value,
        email: email.value,
        senha: senha.value
      })
    });

    const data = await res.json();

    if (!data.ok) {
      showMessage(data.msg, "error");
      return;
    }

    showMessage("Conta criada com sucesso!", "success");
    setTimeout(() => window.location.href = "login.html", 700);

  } catch (err) {
    showMessage("Erro no servidor!", "error");
  }
}

/* ================================
   LOGOUT
================================ */
async function logoutUser() {
  try {
    const res = await fetch(`${API_URL}/logout`, {
      method: "POST"
    });

    const data = await res.json();

    if (data.ok) {
      showMessage("Saindo...", "info");
      setTimeout(() => window.location.href = "login.html", 700);
    }
  } catch (err) {
    showMessage("Erro ao sair!", "error");
  }
}

/* ================================
   UPLOAD DE LIVROS
================================ */
async function uploadBook(event) {
  event.preventDefault();

  const titulo = document.querySelector("#titulo");
  const autor = document.querySelector("#autor");
  const arquivo = document.querySelector("#arquivo");

  if (!arquivo.files[0]) {
    showMessage("Selecione um arquivo!", "error");
    return;
  }

  const form = new FormData();
  form.append("titulo", titulo.value);
  form.append("autor", autor.value);
  form.append("arquivo", arquivo.files[0]);

  try {
    const res = await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: form
    });

    const data = await res.json();

    if (!data.ok) {
      showMessage(data.msg, "error");
      return;
    }

    showMessage("Livro enviado com sucesso!", "success");
    loadBooks();

  } catch (err) {
    showMessage("Erro ao enviar livro.", "error");
  }
}

/* ================================
   LISTAR LIVROS NA DASHBOARD
================================ */
async function loadBooks(search = "") {
  const container = document.querySelector("#lista-livros");
  if (!container) return;

  container.innerHTML = `<p class="loading">Carregando...</p>`;

  try {
    const res = await fetch(`${API_URL}/books?q=${encodeURIComponent(search)}`);
    const data = await res.json();

    if (!data.ok) {
      container.innerHTML = "<p>Erro ao carregar livros.</p>";
      return;
    }

    if (data.books.length === 0) {
      container.innerHTML = "<p>Nenhum livro encontrado.</p>";
      return;
    }

    container.innerHTML = "";

    data.books.forEach(book => {
      const card = document.createElement("div");
      card.classList.add("book-card");

      card.innerHTML = `
                <h3>${book.titulo}</h3>
                <p><strong>Autor:</strong> ${book.autor || "Desconhecido"}</p>
                <a href="http://localhost:5000/uploads/${book.filename}" 
                   target="_blank" 
                   class="btn-secondary">Abrir arquivo</a>
            `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Falha ao conectar ao servidor.</p>";
  }
}

/* ================================
   PESQUISAR LIVROS
================================ */
function searchBooks() {
  const input = document.querySelector("#search");
  loadBooks(input.value.trim());
}

/* ================================
   AÇÕES AUTOMÁTICAS NAS PÁGINAS
================================ */
document.addEventListener("DOMContentLoaded", () => {

  // LOGIN
  const loginForm = document.querySelector("#login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }

  // CADASTRO
  const cadForm = document.querySelector("#cadastro-form");
  if (cadForm) {
    cadForm.addEventListener("submit", registerUser);
  }

  // UPLOAD
  const uploadForm = document.querySelector("#upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", uploadBook);
  }

  // SEARCH
  const searchInput = document.querySelector("#search");
  if (searchInput) {
    searchInput.addEventListener("input", searchBooks);
  }

  // DASHBOARD (carregar livros)
  if (document.querySelector("#lista-livros")) {
    loadBooks();
  }

  // LOGOUT BUTTON
  const logoutBtn = document.querySelector("#logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }

});


