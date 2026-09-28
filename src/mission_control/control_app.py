"""Run privately: uvicorn src.mission_control.control_app:app --host 127.0.0.1 --port 18091 --workers 1"""
from .api import create_control_app, load_actor_tokens, store_from_env

app = create_control_app(store_from_env(), load_actor_tokens())
