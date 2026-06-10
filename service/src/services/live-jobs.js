// ╭──────────────────────────────╮
// │  Live Job Feed               │
// │  Broadcasts persisted scan   │
// │  updates to dashboard users. │
// ╰──────────────────────────────╯

const { WebSocket, WebSocketServer } = require("ws");

function createLiveJobFeed(logger = console) {
  let socketServer = null;

  return {
    attach(server) {
      socketServer = new WebSocketServer({
        server,
        path: "/ws/jobs",
      });
      socketServer.on("error", (error) => logger.error(error));
    },

    publish(job) {
      if (!socketServer) {
        return;
      }

      const message = JSON.stringify({ type: "job.updated", job });
      for (const client of socketServer.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message, (error) => {
            if (error) {
              logger.error(error);
            }
          });
        }
      }
    },

    stop() {
      if (socketServer) {
        for (const client of socketServer.clients) {
          client.terminate();
        }
        socketServer.close();
        socketServer = null;
      }
    },
  };
}

module.exports = {
  createLiveJobFeed,
};
