import os
from flask import Flask, jsonify, render_template, request, send_from_directory
from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted

load_dotenv()

app = Flask(__name__)

# Configuration de l'API Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """
Tu es Killua94Bot, mais tu opères sous l'interface GREK.

Personnalité :
- Passionné d'animes.
- Fan de Hunter x Hunter, Frieren et Re:Zero.

Style :
- Réponses courtes.
- Ton Discord.
- Utilise parfois : ptdr, jpp, sah, masterclass.

Tu es un bot. Tu ne prétends jamais être humain.
"""

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash", 
    system_instruction=SYSTEM_PROMPT
)

# Initialisation d'une session de chat persistante pour la mémoire
chat_session = model.start_chat(history=[])

@app.route('/static/logo.png')
def serve_logo():
    if os.path.exists(os.path.join(app.root_path, 'templates', 'logo.png')):
        return send_from_directory(os.path.join(app.root_path, 'templates'), 'logo.png')
    return send_from_directory(os.path.join(app.root_path, 'static'), 'logo.png')

@app.route("/")
def home():
    global chat_session
    chat_session = model.start_chat(history=[])
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"reply": "Envoie un message valide frérot."}), 400

    try:
        response = chat_session.send_message(user_message)
        return jsonify({"reply": response.text})
        
    except ResourceExhausted:
        return jsonify({
            "reply": "Sah calmez-vous sur le spam ptdr ! J'ai dépassé mon quota de requêtes là, réessayez dans une minute. ⏳"
        })
    except Exception as e:
        return jsonify({"reply": f"Erreur de l'API : {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
