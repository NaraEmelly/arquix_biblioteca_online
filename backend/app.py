import os
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from models import db, User, Book
from config import Config


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # ---------------------------
    # Inicialização (DB + LOGIN)
    # ---------------------------
    db.init_app(app)

    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = "login"

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # cria pasta de uploads
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # ---------------------------
    # Teste rápido
    # ---------------------------
    @app.route("/api/ping")
    def ping():
        return jsonify({"ok": True, "msg": "backend ativo"})

    # ---------------------------
    # REGISTRO
    # ---------------------------
    @app.route("/api/register", methods=["POST"])
    def register():
        data = request.json or {}
        nome = data.get("nome", "").strip()
        email = data.get("email", "").strip().lower()
        senha = data.get("senha", "")

        if not nome or not email or not senha:
            return jsonify({"ok": False, "msg": "Nome, email e senha são obrigatórios."}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"ok": False, "msg": "Email já cadastrado."}), 409

        senha_hash = generate_password_hash(senha)
        user = User(nome=nome, email=email, senha_hash=senha_hash)
        db.session.add(user)
        db.session.commit()

        return jsonify({"ok": True, "msg": "Conta criada com sucesso."}), 201

    # ---------------------------
    # LOGIN
    # ---------------------------
    @app.route("/api/login", methods=["POST"])
    def login():
        data = request.json or {}
        email = data.get("email", "").strip().lower()
        senha = data.get("senha", "")

        if not email or not senha:
            return jsonify({"ok": False, "msg": "Email e senha são obrigatórios."}), 400

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.senha_hash, senha):
            return jsonify({"ok": False, "msg": "Credenciais inválidas."}), 401

        login_user(user)
        return jsonify({
            "ok": True,
            "msg": "Login efetuado.",
            "user": {"id": user.id, "nome": user.nome, "email": user.email}
        })

    # ---------------------------
    # LOGOUT
    # ---------------------------
    @app.route("/api/logout", methods=["POST"])
    @login_required
    def logout():
        logout_user()
        return jsonify({"ok": True, "msg": "Logout realizado."})

    # ---------------------------
    # Upload
    # ---------------------------
    def allowed_file(filename):
        return "." in filename and filename.rsplit(".", 1)[1].lower() in app.config["ALLOWED_EXTENSIONS"]

    @app.route("/api/upload", methods=["POST"])
    @login_required
    def upload():
        if "arquivo" not in request.files:
            return jsonify({"ok": False, "msg": "Arquivo não enviado."}), 400

        arquivo = request.files["arquivo"]
        titulo = request.form.get("titulo", "").strip()
        autor = request.form.get("autor", "").strip()

        if arquivo.filename == "":
            return jsonify({"ok": False, "msg": "Arquivo sem nome."}), 400

        if not allowed_file(arquivo.filename):
            return jsonify({"ok": False, "msg": "Formato não permitido. Use PDF ou EPUB."}), 400

        filename = secure_filename(arquivo.filename)
        filename_on_disk = f"{int(time.time())}_{current_user.id}_{filename}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename_on_disk)
        arquivo.save(save_path)

        book = Book(
            titulo=titulo or filename,
            autor=autor,
            filename=filename_on_disk,
            uploaded_by=current_user.id
        )
        db.session.add(book)
        db.session.commit()

        return jsonify({
            "ok": True,
            "msg": "Arquivo enviado.",
            "book": {"id": book.id, "titulo": book.titulo, "autor": book.autor}
        }), 201

    # ---------------------------
    # Listagem
    # ---------------------------
    @app.route("/api/books", methods=["GET"])
    def list_books():
        q = request.args.get("q", "").strip().lower()
        mine = request.args.get("mine", "false").lower() == "true"

        query = Book.query
        if mine and current_user.is_authenticated:
            query = query.filter_by(uploaded_by=current_user.id)

        if q:
            query = query.filter(
                (Book.titulo.ilike(f"%{q}%")) |
                (Book.autor.ilike(f"%{q}%"))
            )

        books = query.order_by(Book.uploaded_at.desc()).all()

        return jsonify({
            "ok": True,
            "books": [
                {
                    "id": b.id,
                    "titulo": b.titulo,
                    "autor": b.autor,
                    "filename": b.filename,
                    "uploaded_by": b.uploaded_by,
                    "uploaded_at": b.uploaded_at.isoformat()
                }
                for b in books
            ]
        })

    # ---------------------------
    # Download
    # ---------------------------
    @app.route("/uploads/<path:filename>")
    def serve_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=False)

    # ---------------------------
    # Inicialização do banco
    # ---------------------------
    with app.app_context():
        db.create_all()  # seguro e compatível com Flask 3.x

    return app


# EXECUÇÃO DIRETA
if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
