"""GUI-only local Telegram session setup; keeps OTP and session off the chat."""

import asyncio
import os
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox

from dotenv import load_dotenv, set_key
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession


ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)


class AuthWindow:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Telegram session setup")
        self.root.resizable(False, False)
        self.value = tk.StringVar()
        self.status = tk.StringVar(value="Enter the Telegram phone number.")
        self.submit_event = threading.Event()
        self.response = ""
        self.stage = "phone"

        tk.Label(root, textvariable=self.status, width=50, anchor="w").pack(padx=16, pady=(16, 8))
        self.entry = tk.Entry(root, textvariable=self.value, width=50)
        self.entry.pack(padx=16, pady=4)
        self.entry.focus_set()
        self.button = tk.Button(root, text="Continue", command=self.submit)
        self.button.pack(pady=(8, 16))
        self.entry.bind("<Return>", lambda _event: self.submit())

    def submit(self) -> None:
        value = self.value.get().strip()
        if not value:
            return
        self.response = value
        self.value.set("")
        self.submit_event.set()
        self.button.config(state="disabled")

    def prompt(self, stage: str, text: str, secret: bool = False) -> None:
        self.stage = stage
        self.status.set(text)
        self.entry.config(show="*" if secret else "")
        self.button.config(state="normal")
        self.entry.focus_set()

    def wait_for_response(self) -> str:
        self.submit_event.wait()
        self.submit_event.clear()
        self.button.config(state="disabled")
        return self.response

    def finish(self, message: str, error: bool = False) -> None:
        if error:
            messagebox.showerror("Telegram setup failed", message)
        else:
            messagebox.showinfo("Telegram setup complete", message)
        self.root.destroy()


def run_auth(window: AuthWindow, api_id: int, api_hash: str) -> None:
    async def authenticate() -> None:
        phone = window.wait_for_response()
        client = TelegramClient(StringSession(), api_id, api_hash)
        try:
            await client.connect()
            await client.send_code_request(phone)
            window.root.after(0, window.prompt, "code", "Enter the code received in Telegram:")
            code = window.wait_for_response()
            try:
                await client.sign_in(phone=phone, code=code)
            except SessionPasswordNeededError:
                window.root.after(0, window.prompt, "password", "Enter your Telegram 2FA password:", True)
                password = window.wait_for_response()
                await client.sign_in(password=password)
            session = client.session.save()
            set_key(str(ENV_PATH), "TELEGRAM_API_ID", str(api_id))
            set_key(str(ENV_PATH), "TELEGRAM_API_HASH", api_hash)
            set_key(str(ENV_PATH), "TELEGRAM_SESSION", session)
            window.root.after(0, window.finish, "Session saved to a-function/.env. You can close this window.")
        except Exception as error:
            window.root.after(0, window.finish, str(error), True)
        finally:
            await client.disconnect()

    asyncio.run(authenticate())


def main() -> None:
    api_id = int(os.environ.get("TELEGRAM_API_ID", "38304365"))
    api_hash = os.environ.get("TELEGRAM_API_HASH")
    if not api_hash:
        raise RuntimeError("Set TELEGRAM_API_HASH before launching this GUI")
    root = tk.Tk()
    window = AuthWindow(root)
    threading.Thread(target=run_auth, args=(window, api_id, api_hash), daemon=True).start()
    root.mainloop()


if __name__ == "__main__":
    main()
