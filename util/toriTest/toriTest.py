# ╭──────────────────────────────╮
# │  TORI Server Tester         │
# │  Runs a local Textual TUI   │
# │  for discovery, OCR scans,  │
# │  and text-match requests.   │
# ╰──────────────────────────────╯
#
# /// script
# dependencies = [
#   "requests>=2.32.0",
#   "textual>=0.79.0",
#   "zeroconf>=0.132.0",
# ]
# ///

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import Event
from typing import Any
import ipaddress
import socket

import requests
from textual import work
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.message import Message
from textual.widgets import Button, DataTable, Footer, Header, Input, Label, Static
from zeroconf import ServiceBrowser, ServiceInfo, Zeroconf


SERVICE_TYPE = "_tori-ocr._tcp.local."
DEFAULT_PORT = 8020


@dataclass
class DiscoveredService:
    instance_name: str
    host: str
    ip: str
    port: int


class MdnsListener:
    def __init__(self) -> None:
        self.event = Event()
        self.service_name: str | None = None

    def add_service(self, _zeroconf: Zeroconf, _service_type: str, name: str) -> None:
        self.service_name = name
        self.event.set()

    def update_service(self, _zeroconf: Zeroconf, _service_type: str, name: str) -> None:
        self.service_name = name
        self.event.set()

    def remove_service(self, _zeroconf: Zeroconf, _service_type: str, _name: str) -> None:
        return


def clean_path(raw_value: str) -> Path:
    value = raw_value.strip()
    if value.startswith(("'", '"')) and value.endswith(("'", '"')) and len(value) >= 2:
        value = value[1:-1]
    return Path(value).expanduser()


def resolve_host_ip(host: str) -> str:
    try:
        return socket.gethostbyname(host)
    except OSError:
        return ""


def format_error(error: Exception) -> str:
    return str(error) or error.__class__.__name__


def discover_service(timeout: float = 2.0) -> DiscoveredService | None:
    zeroconf = Zeroconf()
    listener = MdnsListener()
    browser = ServiceBrowser(zeroconf, SERVICE_TYPE, listener)

    try:
        listener.event.wait(timeout)

        if not listener.service_name:
            return None

        info = zeroconf.get_service_info(SERVICE_TYPE, listener.service_name, timeout=int(timeout * 1000))
        if not info:
            return None

        ip = extract_ip(info)
        host = info.server.rstrip(".") if info.server else ""

        return DiscoveredService(
            instance_name=listener.service_name.rstrip("."),
            host=host or ip,
            ip=ip,
            port=info.port or DEFAULT_PORT,
        )
    finally:
        browser.cancel()
        zeroconf.close()


def extract_ip(info: ServiceInfo) -> str:
    for address in info.parsed_scoped_addresses():
        try:
            parsed = ipaddress.ip_address(address)
        except ValueError:
            continue

        if parsed.version == 4:
            return address

    addresses = info.parsed_scoped_addresses()
    return addresses[0] if addresses else ""


class ToriClient:
    def __init__(self, host: str, port: int) -> None:
        self.host = host.strip()
        self.port = port

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def fetch_health(self) -> dict[str, Any]:
        response = requests.get(f"{self.base_url}/api/health", timeout=5)
        response.raise_for_status()
        return response.json()

    def scan_image(self, image_path: Path) -> dict[str, Any]:
        with image_path.open("rb") as image_file:
            response = requests.post(
                f"{self.base_url}/api/scan",
                files={"image": (image_path.name, image_file)},
                timeout=30,
            )

        response.raise_for_status()
        return response.json()

    def match_text(self, text: str) -> dict[str, Any]:
        response = requests.post(
            f"{self.base_url}/api/match-text",
            json={"text": text},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()


class ResultMessage(Message):
    def __init__(self, kind: str, payload: dict[str, Any], detail: str) -> None:
        self.kind = kind
        self.payload = payload
        self.detail = detail
        super().__init__()


class ErrorMessage(Message):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__()


class ToriTesterApp(App[None]):
    CSS = """
    Screen {
        layout: vertical;
    }

    #main-grid {
        layout: grid;
        grid-size: 2 2;
        grid-gutter: 1 1;
        height: 1fr;
        padding: 1;
    }

    .panel {
        border: round $accent;
        padding: 1;
    }

    #result-panel {
        column-span: 2;
    }

    .field-row {
        layout: horizontal;
        height: auto;
        margin-bottom: 1;
    }

    .field-row Input {
        width: 1fr;
    }

    .field-row Button {
        margin-left: 1;
    }

    #server-status {
        height: 8;
    }

    #result-summary {
        height: 7;
        margin-bottom: 1;
    }

    #candidate-table {
        height: 1fr;
    }
    """

    BINDINGS = [
        ("r", "refresh_server", "Refresh Server"),
        ("s", "submit_scan", "Send Image"),
        ("m", "submit_text", "Match Text"),
        ("q", "quit", "Quit"),
    ]

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="main-grid"):
            with Vertical(classes="panel"):
                yield Label("Server")
                with Horizontal(classes="field-row"):
                    yield Input(placeholder="Host or IP", id="host-input")
                    yield Input(value=str(DEFAULT_PORT), placeholder="Port", id="port-input")
                    yield Button("Refresh", id="refresh-server")
                yield Static("No server data yet.", id="server-status")
            with Vertical(classes="panel"):
                yield Label("Image Scan")
                yield Static(
                    "Paste or drag a local image path into the field, then submit it to /api/scan.",
                    classes="hint",
                )
                with Horizontal(classes="field-row"):
                    yield Input(placeholder="/path/to/label.jpg", id="image-input")
                    yield Button("Send Image", id="send-image")
            with Vertical(classes="panel"):
                yield Label("Manual Text Match")
                yield Static(
                    "Submit OCR text directly to /api/match-text to inspect ranked candidates.",
                    classes="hint",
                )
                with Horizontal(classes="field-row"):
                    yield Input(placeholder="Type label text here", id="text-input")
                    yield Button("Match Text", id="match-text")
            with Vertical(classes="panel", id="result-panel"):
                yield Label("Results")
                yield Static("No requests sent yet.", id="result-summary")
                yield DataTable(id="candidate-table")
        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one("#candidate-table", DataTable)
        table.add_columns("Rank", "Name", "PartNumber", "ID", "Score", "Quantity")
        self.action_refresh_server()

    def action_refresh_server(self) -> None:
        host = self.query_one("#host-input", Input).value.strip()
        port_text = self.query_one("#port-input", Input).value.strip()
        self.refresh_server(host, port_text)

    def action_submit_scan(self) -> None:
        self.handle_scan_submission()

    def action_submit_text(self) -> None:
        self.handle_text_submission()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "refresh-server":
            self.action_refresh_server()
        elif event.button.id == "send-image":
            self.handle_scan_submission()
        elif event.button.id == "match-text":
            self.handle_text_submission()

    def handle_scan_submission(self) -> None:
        image_input = self.query_one("#image-input", Input)
        try:
            image_path = clean_path(image_input.value)
        except Exception as error:
            self.post_message(ErrorMessage(f"Invalid image path: {format_error(error)}"))
            return

        if not image_path.is_file():
            self.post_message(ErrorMessage(f"Image path not found: {image_path}"))
            return

        try:
            client = self.current_client()
        except Exception as error:
            self.post_message(ErrorMessage(format_error(error)))
            return

        self.send_scan(client, image_path)

    def handle_text_submission(self) -> None:
        text = self.query_one("#text-input", Input).value.strip()
        if not text:
            self.post_message(ErrorMessage("Text is required for manual match testing."))
            return

        try:
            client = self.current_client()
        except Exception as error:
            self.post_message(ErrorMessage(format_error(error)))
            return

        self.send_text_match(client, text)

    def current_client(self) -> ToriClient:
        host = self.query_one("#host-input", Input).value.strip()
        port_text = self.query_one("#port-input", Input).value.strip()

        if not host:
            raise ValueError("Host is required")

        try:
            port = int(port_text)
        except ValueError as error:
            raise ValueError("Port must be a number") from error

        return ToriClient(host, port)

    @work(thread=True, exclusive=True, group="server")
    def refresh_server(self, manual_host: str, manual_port_text: str) -> None:
        discovered = discover_service()
        host = manual_host
        port_text = manual_port_text

        if discovered:
            host = discovered.ip or discovered.host
            port_text = str(discovered.port)

            def apply_discovery() -> None:
                host_input = self.query_one("#host-input", Input)
                port_input = self.query_one("#port-input", Input)
                host_input.value = host
                port_input.value = port_text

            self.call_from_thread(apply_discovery)

        try:
            port = int(port_text)
        except ValueError as error:
            self.call_from_thread(self.post_message, ErrorMessage("Port must be a number"))
            return

        if not host:
            self.call_from_thread(self.post_message, ErrorMessage("Host is required"))
            return

        client = ToriClient(host, port)

        try:
            payload = client.fetch_health()
        except Exception as error:
            detail = "Discovery failed." if not discovered else f"Resolved {discovered.instance_name} but health check failed."
            self.call_from_thread(self.post_message, ErrorMessage(f"{detail} {format_error(error)}"))
            return

        if discovered:
            detail = f"Discovered {discovered.instance_name}"
        else:
            detail = "Connected with manual host/port"

        self.call_from_thread(self.post_message, ResultMessage("health", payload, detail))

    @work(thread=True, exclusive=True, group="request")
    def send_scan(self, client: ToriClient, image_path: Path) -> None:
        try:
            payload = client.scan_image(image_path)
            self.call_from_thread(
                self.post_message,
                ResultMessage("scan", payload, f"Scanned {image_path.name}"),
            )
        except Exception as error:
            self.call_from_thread(
                self.post_message,
                ErrorMessage(f"Image scan failed: {format_error(error)}"),
            )

    @work(thread=True, exclusive=True, group="request")
    def send_text_match(self, client: ToriClient, text: str) -> None:
        try:
            payload = client.match_text(text)
            self.call_from_thread(
                self.post_message,
                ResultMessage("text", payload, "Matched submitted text"),
            )
        except Exception as error:
            self.call_from_thread(
                self.post_message,
                ErrorMessage(f"Text match failed: {format_error(error)}"),
            )

    def on_result_message(self, message: ResultMessage) -> None:
        if message.kind == "health":
            self.render_health(message.payload, message.detail)
            return

        self.render_results(message.payload, message.detail)

    def on_error_message(self, message: ErrorMessage) -> None:
        result_summary = self.query_one("#result-summary", Static)
        result_summary.update(message.detail)

    def render_health(self, payload: dict[str, Any], detail: str) -> None:
        host = self.query_one("#host-input", Input).value.strip()
        port = self.query_one("#port-input", Input).value.strip()
        resolved_ip = resolve_host_ip(host)
        lines = [
            detail,
            f"Service: {payload.get('service', 'unknown')}",
            f"Version: {payload.get('version', 'unknown')}",
            f"mDNS Name: {payload.get('mdnsName', 'unknown')}",
            f"Host: {host or 'unknown'}",
            f"IP: {resolved_ip or host or 'unknown'}",
            f"Port: {payload.get('port', port or 'unknown')}",
        ]
        self.query_one("#server-status", Static).update("\n".join(lines))

    def render_results(self, payload: dict[str, Any], detail: str) -> None:
        match = payload.get("match") or {}
        candidates = payload.get("candidates") or []
        summary_lines = [
            detail,
            f"OCR/Text: {payload.get('ocrText') or '(empty)'}",
            f"Best Match: {match.get('name') or 'None'}",
            f"PartNumber: {match.get('secondaryName') or '-'}",
            f"Match ID: {match.get('id') or '-'}",
            f"Quantity: {match.get('quantity', '-')}",
            f"Score: {match.get('score', '-')}",
        ]
        self.query_one("#result-summary", Static).update("\n".join(summary_lines))

        table = self.query_one("#candidate-table", DataTable)
        table.clear()

        for index, candidate in enumerate(candidates, start=1):
            table.add_row(
                str(index),
                str(candidate.get("name", "")),
                str(candidate.get("secondaryName", "")),
                str(candidate.get("id", "")),
                str(candidate.get("score", "")),
                str(candidate.get("quantity", "")),
            )


if __name__ == "__main__":
    ToriTesterApp().run()
