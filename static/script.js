// --- Elementos do DOM ---
const telaLogin = document.getElementById("telaLogin");
const telaCadastro = document.getElementById("telaCadastro");
const telaBiblioteca = document.getElementById("telaBiblioteca");
const telaAdmin = document.getElementById("telaAdmin");

const formLogin = document.getElementById("formLogin");
const formCadastro = document.getElementById("formCadastro");

const linkCadastro = document.getElementById("linkCadastro");
const linkLogin = document.getElementById("linkLogin");
const botaoSair = document.getElementById("botaoSair");

const botaoAdmin = document.getElementById("botaoAdmin");
const botaoVoltarLib = document.getElementById("botaoVoltarLib");
const formAddLivro = document.getElementById("formAddLivro");
const corpoTabelaEmprestimos = document.getElementById("corpoTabelaEmprestimos");

const containerLinhas = document.getElementById("containerLinhas");
const carregando = document.getElementById("carregando");
const nomeUsuarioDisplay = document.getElementById("nomeUsuarioDisplay");
const erroLogin = document.getElementById("erroLogin");
const erroCadastro = document.getElementById("erroCadastro");

// --- Estado Global ---
let usuarioAtual = null;

const sessaoSalva = localStorage.getItem("usuarioBookflix");
if (sessaoSalva) {
    try {
        usuarioAtual = JSON.parse(sessaoSalva);
        
        inicializarAppComUsuario();
    } catch (e) {
        console.error("Erro ao restaurar sessão", e);
        localStorage.removeItem("usuarioBookflix");
    }
}

// --- Funções Auxiliares ---

function mostrarErro(elemento, msg) {
    if (!msg) return elemento.classList.add("escondido");
    elemento.textContent = msg;
    elemento.classList.remove("escondido");
}

// Função central para configurar a tela quando o usuário loga (ou volta do F5)
function inicializarAppComUsuario() {
    
    nomeUsuarioDisplay.textContent = usuarioAtual.nome;

   
    if (usuarioAtual.ehAdmin) {
        botaoAdmin.classList.remove("escondido");
    } else {
        botaoAdmin.classList.add("escondido");
    }

    
    telaLogin.classList.add("escondido");
    telaCadastro.classList.add("escondido");
    telaBiblioteca.classList.remove("escondido");

    
    carregarBiblioteca();
}

async function enviarRequisicao(url, dados) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dados)
        });
        const respostaDados = await res.json().catch(() => ({ mensagem: "Erro inesperado" }));
        return { ok: res.ok, dados: respostaDados };
    } catch (e) {
        return { ok: false, dados: { mensagem: "Erro de conexão" } };
    }
}

// --- Navegação Login/Cadastro ---

linkCadastro.addEventListener("click", (e) => {
    e.preventDefault();
    telaLogin.classList.add("escondido");
    telaCadastro.classList.remove("escondido");
});

linkLogin.addEventListener("click", (e) => {
    e.preventDefault();
    telaCadastro.classList.add("escondido");
    telaLogin.classList.remove("escondido");
});

// --- Formulário de Cadastro ---

formCadastro.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarErro(erroCadastro, "");

    const payload = {
        nome: document.getElementById("nomeCadastro").value,
        email: document.getElementById("emailCadastro").value,
        senha: document.getElementById("senhaCadastro").value
    };

    const { ok, dados } = await enviarRequisicao("/cadastrar", payload);
    if (!ok) return mostrarErro(erroCadastro, dados.mensagem);

    alert("Cadastro realizado! Faça login.");
    formCadastro.reset();
    telaCadastro.classList.add("escondido");
    telaLogin.classList.remove("escondido");
});

// --- Formulário de Login ---

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarErro(erroLogin, "");

    const payload = {
        email: document.getElementById("emailLogin").value,
        senha: document.getElementById("senhaLogin").value
    };

    const { ok, dados } = await enviarRequisicao("/entrar", payload);
    if (!ok) return mostrarErro(erroLogin, dados.mensagem);

    
    usuarioAtual = dados.usuario; 
    
    
    localStorage.setItem("usuarioBookflix", JSON.stringify(usuarioAtual));

    inicializarAppComUsuario();
});

// --- Logout ---

botaoSair.addEventListener("click", () => {
    usuarioAtual = null;
    
    
    localStorage.removeItem("usuarioBookflix");

    telaBiblioteca.classList.add("escondido");
    telaAdmin.classList.add("escondido");
    telaLogin.classList.remove("escondido");
    
    containerLinhas.innerHTML = ""; 
});

// --- Área Admin ---

botaoAdmin.addEventListener("click", () => {
    telaBiblioteca.classList.add("escondido");
    telaAdmin.classList.remove("escondido");
    telaAdmin.style.display = "block"; 
    carregarDadosAdmin();
});

botaoVoltarLib.addEventListener("click", () => {
    telaAdmin.classList.add("escondido");
    telaAdmin.style.display = "none";
    telaBiblioteca.classList.remove("escondido");
    carregarBiblioteca(); 
});

async function carregarDadosAdmin() {
    corpoTabelaEmprestimos.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
    const res = await fetch("/admin/emprestimos");
    const emprestimos = await res.json();
    corpoTabelaEmprestimos.innerHTML = "";

    if(emprestimos.length === 0) {
        corpoTabelaEmprestimos.innerHTML = "<tr><td colspan='6'>Nenhum empréstimo registrado.</td></tr>";
        return;
    }

    emprestimos.forEach(emp => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #333";
        
        const devolvido = !!emp.return_date;
        const textoStatus = devolvido ? "Devolvido" : "Emprestado";
        const corStatus = devolvido ? "#46d369" : "#e50914";

        tr.innerHTML = `
            <td style="padding: 10px;">#${emp.id}</td>
            <td style="padding: 10px; color: white; font-weight:bold;">${emp.title}</td>
            <td style="padding: 10px;">${emp.nome_usuario}</td>
            <td style="padding: 10px;">${emp.loan_date}</td>
            <td style="padding: 10px;">${emp.return_date || "-"}</td>
            <td style="padding: 10px; color: ${corStatus};">${textoStatus}</td>
        `;
        corpoTabelaEmprestimos.appendChild(tr);
    });
}

formAddLivro.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        titulo: document.getElementById("novoTitulo").value,
        autor: document.getElementById("novoAutor").value,
        categoria: document.getElementById("novaCategoria").value,
        capaUrl: document.getElementById("novaCapa").value
    };

    const { ok, dados } = await enviarRequisicao("/admin/adicionar-livro", payload);
    if (ok) {
        alert("Livro adicionado com sucesso!");
        formAddLivro.reset();
    } else {
        alert("Erro: " + dados.mensagem);
    }
});

// --- Lógica da Biblioteca (Frontend) ---

async function carregarBiblioteca() {
    containerLinhas.innerHTML = "";
    carregando.classList.remove("escondido");
    containerLinhas.appendChild(carregando);

    try {
        // Carrega Meus Livros
        await carregarLinha("Meus Livros Alugados", `/meus-emprestimos?idUsuario=${usuarioAtual.id}`, true);
        // Carrega Todos os Livros
        await carregarLinha("Catálogo Disponível", "/livros", false);
    } catch (error) {
        console.error(error);
    } finally {
        carregando.classList.add("escondido");
    }
}

async function carregarLinha(titulo, url, listaPessoal) {
    const res = await fetch(url);
    const dados = await res.json();
    // Garante que seja um array
    const livros = Array.isArray(dados) ? dados : (dados.itens || []);

    // Se for minha lista e estiver vazia, não mostra a linha
    if (livros.length === 0 && listaPessoal) return;

    const divLinha = document.createElement("div");
    divLinha.className = "linha";
    
    const tituloEl = document.createElement("h3");
    tituloEl.textContent = titulo;

    const divPosters = document.createElement("div");
    divPosters.className = "linha-posters";

    livros.forEach(livro => {
        const poster = criarPoster(livro, listaPessoal);
        divPosters.appendChild(poster);
    });

    divLinha.appendChild(tituloEl);
    divLinha.appendChild(divPosters);
    containerLinhas.appendChild(divLinha);
}

function criarPoster(livro, listaPessoal) {
    const card = document.createElement("div");
    card.className = "cartao-poster"; 

    const img = document.createElement("img");
    img.className = "poster-img";
    // Usa placeholder se não tiver capa
    img.src = livro.cover_url || "https://via.placeholder.com/128x196?text=Capa";
    img.alt = livro.title;
    card.appendChild(img);

    const divAcoes = document.createElement("div");
    divAcoes.className = "poster-acoes";

    // Lógica de Exibição dos Botões
    if (!listaPessoal && livro.is_available === 0) {
        
        const badge = document.createElement("div");
        badge.style.width = "100%";
        badge.style.background = "rgba(20, 20, 20, 0.8)";
        badge.style.color = "#999";
        badge.style.fontSize = "11px";
        badge.style.padding = "4px";
        badge.style.textAlign = "center";
        badge.textContent = livro.nome_quem_emprestou ? `Com ${livro.nome_quem_emprestou}` : "Indisponível";
        
        divAcoes.style.opacity = "1";
        divAcoes.style.background = "none";
        divAcoes.style.alignItems = "flex-end";
        divAcoes.appendChild(badge);
        
        img.style.opacity = "0.5";
        img.style.cursor = "not-allowed";

    } else {
        
        const btn = document.createElement("button");
        btn.className = "botao-acao";

        if (listaPessoal) {
            btn.textContent = "Devolver";
            btn.classList.add("btn-devolver");
            btn.onclick = (e) => {
                e.stopPropagation(); 
                processarDevolucao(livro.id);
            };
        } else {
            btn.textContent = "Pegar Emprestado";
            btn.classList.add("btn-pegar");
            btn.onclick = (e) => {
                e.stopPropagation();
                processarEmprestimo(livro.id);
            };
        }
        divAcoes.appendChild(btn);
    }

    card.appendChild(divAcoes);
    return card;
}

// --- Ações de API ---

async function processarEmprestimo(idLivro) {
    const { ok, dados } = await enviarRequisicao("/emprestar", {
        idUsuario: usuarioAtual.id,
        idLivro: idLivro
    });

    if (ok) {
        carregarBiblioteca();
    } else {
        alert(dados.mensagem || "Erro ao emprestar.");
    }
}

async function processarDevolucao(idLivro) {
    const { ok, dados } = await enviarRequisicao("/devolver", {
        idUsuario: usuarioAtual.id,
        idLivro: idLivro
    });

    if (ok) {
        carregarBiblioteca();
    } else {
        alert("Erro ao devolver.");
    }
}