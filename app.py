import sqlite3
import hashlib
from datetime import datetime
from flask import Flask, request, jsonify, g, send_from_directory
import os

app = Flask(__name__, static_folder='static', static_url_path='')
NOME_BANCO = 'users.db'

def conectar_banco():
    banco = getattr(g, '_database', None)
    if banco is None:
        banco = g._database = sqlite3.connect(NOME_BANCO, check_same_thread=False)
        banco.row_factory = sqlite3.Row
    return banco

@app.teardown_appcontext
def fechar_conexao(exception):
    banco = getattr(g, '_database', None)
    if banco is not None:
        banco.close()

def inicializar_banco():
    with app.app_context():
        banco = conectar_banco()
        
        banco.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        ''')
        
        banco.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT,
                category TEXT,
                cover_url TEXT,
                is_available INTEGER DEFAULT 1
            )
        ''')

        banco.execute('''
            CREATE TABLE IF NOT EXISTS loans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                book_id INTEGER,
                loan_date TEXT,
                return_date TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(book_id) REFERENCES books(id)
            )
        ''')
        
        cursor = banco.cursor()
        cursor.execute("SELECT COUNT(*) FROM books")
        if cursor.fetchone()[0] == 0:
            livros_exemplo = [
                ('Código Limpo', 'Robert C. Martin', 'Tecnologia', 'https://m.media-amazon.com/images/I/71T7aD3EOTL._AC_UF1000,1000_QL80_.jpg', 1),
                ('Pai Rico, Pai Pobre', 'Robert Kiyosaki', 'Negócios', 'https://m.media-amazon.com/images/I/81ALgAW3gHL._AC_UF1000,1000_QL80_.jpg', 1),
                ('O Hobbit', 'J.R.R. Tolkien', 'Aventura', 'https://m.media-amazon.com/images/I/91M9xPIf10L._AC_UF1000,1000_QL80_.jpg', 1),
                ('1984', 'George Orwell', 'Ficção', 'https://m.media-amazon.com/images/I/819js3EQwbL._AC_UF1000,1000_QL80_.jpg', 1),
                ('Harry Potter e a Pedra Filosofal', 'J.K. Rowling', 'Aventura', 'https://m.media-amazon.com/images/I/81ibfYk4qmL._AC_UF1000,1000_QL80_.jpg', 1),
                ('O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Infantil', 'https://m.media-amazon.com/images/I/71aFt4+OTOL._AC_UF1000,1000_QL80_.jpg', 1)
            ]
            cursor.executemany("INSERT INTO books (title, author, category, cover_url, is_available) VALUES (?, ?, ?, ?, ?)", livros_exemplo)
            banco.commit()
        else:
            banco.commit()

def criptografar_senha(senha):
    return hashlib.sha256(senha.encode('utf-8')).hexdigest()

@app.route('/')
def inicio():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/cadastrar', methods=['POST'])
def cadastrar():
    dados = request.get_json()
    nome = dados.get('nome')
    email = dados.get('email')
    senha = dados.get('senha')

    if not all([nome, email, senha]):
        return jsonify({'mensagem': 'Dados incompletos'}), 400
    if len(senha) < 6:
        return jsonify({'mensagem': 'A senha deve ter no mínimo 6 caracteres'}), 400

    banco = conectar_banco()
    cursor = banco.cursor()
    try:
        hash_senha = criptografar_senha(senha)
        cursor.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", (nome, email.lower(), hash_senha))
        banco.commit()
        return jsonify({'mensagem': 'Usuário registrado com sucesso'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'mensagem': 'Este email já está em uso'}), 409
    except Exception:
        return jsonify({'mensagem': 'Erro interno do servidor'}), 500

@app.route('/entrar', methods=['POST'])
def entrar():
    dados = request.get_json()
    email = dados.get('email')
    senha = dados.get('senha')

    if not all([email, senha]):
        return jsonify({'mensagem': 'Email e senha são obrigatórios'}), 400

    banco = conectar_banco()
    cursor = banco.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.lower(),))
    usuario = cursor.fetchone()

    if usuario is None:
        return jsonify({'mensagem': 'Usuário não encontrado'}), 401

    if criptografar_senha(senha) == usuario['password_hash']:
        eh_admin = (usuario['email'] == 'admin@Arquix.com')
        
        return jsonify({
            'mensagem': 'Login bem-sucedido',
            'usuario': {
                'id': usuario['id'], 
                'nome': usuario['name'], 
                'email': usuario['email'],
                'ehAdmin': eh_admin
            }
        }), 200
    else:
        return jsonify({'mensagem': 'Senha incorreta'}), 401

@app.route('/livros', methods=['GET'])
def listar_livros():
    categoria = request.args.get('categoria')
    banco = conectar_banco()
    cursor = banco.cursor()
    
    query_base = '''
        SELECT b.*, u.name as nome_quem_emprestou 
        FROM books b
        LEFT JOIN loans l ON b.id = l.book_id AND l.return_date IS NULL
        LEFT JOIN users u ON l.user_id = u.id
    '''
    if categoria and categoria != 'bestsellers':
        cursor.execute(query_base + " WHERE b.category LIKE ?", (f'%{categoria}%',))
    else:
        cursor.execute(query_base)
        
    livros = [dict(linha) for linha in cursor.fetchall()]
    return jsonify({'itens': livros})

@app.route('/emprestar', methods=['POST'])
def realizar_emprestimo():
    dados = request.get_json()
    id_usuario = dados.get('idUsuario')
    id_livro = dados.get('idLivro')

    if not id_usuario or not id_livro:
        return jsonify({'mensagem': 'Dados inválidos'}), 400

    banco = conectar_banco()
    cursor = banco.cursor()
    cursor.execute("SELECT is_available FROM books WHERE id = ?", (id_livro,))
    livro = cursor.fetchone()

    if not livro:
        return jsonify({'mensagem': 'Livro não encontrado'}), 404
    if livro['is_available'] == 0:
        return jsonify({'mensagem': 'Livro já está emprestado'}), 409

    try:
        cursor.execute("UPDATE books SET is_available = 0 WHERE id = ?", (id_livro,))
        data_emprestimo = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("INSERT INTO loans (user_id, book_id, loan_date) VALUES (?, ?, ?)", (id_usuario, id_livro, data_emprestimo))
        banco.commit()
        return jsonify({'mensagem': 'Empréstimo realizado!', 'data': data_emprestimo}), 200
    except Exception as e:
        banco.rollback()
        return jsonify({'mensagem': f'Erro: {str(e)}'}), 500

@app.route('/meus-emprestimos', methods=['GET'])
def meus_emprestimos():
    id_usuario = request.args.get('idUsuario')
    if not id_usuario:
        return jsonify({'mensagem': 'Usuário não identificado'}), 400
        
    banco = conectar_banco()
    cursor = banco.cursor()
    cursor.execute('''
        SELECT books.*, loans.loan_date 
        FROM books 
        JOIN loans ON books.id = loans.book_id 
        WHERE loans.user_id = ? AND loans.return_date IS NULL
    ''', (id_usuario,))
    emprestimos = [dict(linha) for linha in cursor.fetchall()]
    return jsonify(emprestimos)

@app.route('/devolver', methods=['POST'])
def devolver_livro():
    dados = request.get_json()
    try:
        id_usuario = int(dados.get('idUsuario'))
        id_livro = int(dados.get('idLivro'))
    except (ValueError, TypeError):
        return jsonify({'mensagem': 'IDs inválidos'}), 400

    banco = conectar_banco()
    cursor = banco.cursor()

    try:
        data_devolucao = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute('''
            UPDATE loans 
            SET return_date = ? 
            WHERE book_id = ? AND user_id = ? AND return_date IS NULL
        ''', (data_devolucao, id_livro, id_usuario))
        
        if cursor.rowcount == 0:
            banco.rollback()
            return jsonify({'mensagem': 'Erro: Empréstimo não encontrado ou pertence a outro usuário.'}), 404

        cursor.execute("UPDATE books SET is_available = 1 WHERE id = ?", (id_livro,))
        banco.commit()
        return jsonify({'mensagem': 'Livro devolvido com sucesso!'})

    except Exception:
        banco.rollback()
        return jsonify({'mensagem': 'Erro interno'}), 500

@app.route('/admin/emprestimos', methods=['GET'])
def admin_emprestimos():
    banco = conectar_banco()
    cursor = banco.cursor()
    cursor.execute('''
        SELECT 
            loans.id, 
            books.title, 
            users.name as nome_usuario, 
            loans.loan_date, 
            loans.return_date 
        FROM loans
        JOIN books ON loans.book_id = books.id
        JOIN users ON loans.user_id = users.id
        ORDER BY loans.loan_date DESC
    ''')
    lista = [dict(linha) for linha in cursor.fetchall()]
    return jsonify(lista)

@app.route('/admin/adicionar-livro', methods=['POST'])
def admin_add_livro():
    dados = request.get_json()
    titulo = dados.get('titulo')
    autor = dados.get('autor')
    categoria = dados.get('categoria')
    capa_url = dados.get('capaUrl')

    if not all([titulo, autor, categoria]):
        return jsonify({'mensagem': 'Preencha os dados obrigatórios'}), 400

    if not capa_url:
        capa_url = "https://via.placeholder.com/128x196?text=Capa"

    banco = conectar_banco()
    cursor = banco.cursor()
    try:
        cursor.execute('''
            INSERT INTO books (title, author, category, cover_url, is_available)
            VALUES (?, ?, ?, ?, 1)
        ''', (titulo, autor, categoria, capa_url))
        banco.commit()
        return jsonify({'mensagem': 'Livro adicionado com sucesso!'}), 201
    except Exception:
        return jsonify({'mensagem': 'Erro ao adicionar livro'}), 500

if __name__ == '__main__':
    inicializar_banco()
    porta = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=porta, debug=True)