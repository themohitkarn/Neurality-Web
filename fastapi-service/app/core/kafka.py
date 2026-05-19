import logging
import asyncio
from confluent_kafka import Producer, Consumer
from app.config import settings

logger = logging.getLogger("fastapi-app")

class KafkaManager:
    def __init__(self):
        self.producer: Producer | None = None
        self.loop = None

    def connect(self):
        """Initialize Kafka Producer client."""
        logger.info(f"Initializing Kafka Producer connected to: {settings.KAFKA_BOOTSTRAP_SERVERS}...")
        self.producer = Producer({
            'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
            'client.id': 'fastapi-producer',
            'queue.buffering.max.messages': 100000
        })
        self.loop = asyncio.get_event_loop()
        logger.info("Kafka Producer client initialized.")

    def delivery_report(self, err, msg):
        """Callback triggered upon successful receipt or failure of event generation."""
        if err is not None:
            logger.error(f"Kafka message delivery failed: {err}")
        else:
            logger.info(f"Kafka event delivered to {msg.topic()} [{msg.partition()}]")

    async def send_event(self, key: str, value: str, topic: str = settings.KAFKA_TOPIC):
        """Produce and push messages to Kafka topic asynchronously."""
        if not self.producer:
            logger.error("Kafka Producer is not initialized.")
            return

        # Execute thread-safe polling inside asyncio loop
        def _produce():
            self.producer.produce(
                topic,
                key=key.encode('utf-8') if key else None,
                value=value.encode('utf-8'),
                callback=self.delivery_report
            )
            # Trigger callback queue execution
            self.producer.flush(0.1)

        await self.loop.run_in_executor(None, _produce)

    def disconnect(self):
        """Flush the remaining callback stack and shutdown safely."""
        if self.producer:
            logger.info("Flushing and shutting down Kafka Producer...")
            self.producer.flush()
            logger.info("Kafka Producer successfully stopped.")

import threading

class KafkaConsumerWorker:
    def __init__(self):
        self.consumer: Consumer | None = None
        self.running = False
        self.thread: threading.Thread | None = None
        self.loop: asyncio.AbstractEventLoop | None = None

    def start(self, loop: asyncio.AbstractEventLoop = None):
        """Start the background consumer thread to poll events cleanly without blocking HTTP main loop."""
        self.loop = loop or asyncio.get_event_loop()
        self.running = True
        self.thread = threading.Thread(target=self._consume_loop, daemon=True)
        self.thread.start()
        logger.info("Background Kafka Consumer daemon spawned successfully.")

    def _consume_loop(self):
        logger.info(f"Kafka Consumer polling started. Connecting to {settings.KAFKA_BOOTSTRAP_SERVERS}...")
        conf = {
            'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
            'group.id': 'fastapi-settings-group',
            'auto.offset.reset': 'earliest',
            'enable.auto.commit': True
        }
        try:
            self.consumer = Consumer(conf)
            self.consumer.subscribe([settings.KAFKA_TOPIC, "notification.created", "graph.edge.updated", "feature.updated"])
            logger.info(f"Kafka Consumer successfully subscribed to topics: {[settings.KAFKA_TOPIC, 'notification.created', 'graph.edge.updated', 'feature.updated']}")
            
            while self.running:
                msg = self.consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                if msg.error():
                    logger.error(f"Kafka consumer polling error: {msg.error()}")
                    continue

                topic = msg.topic()
                key = msg.key().decode('utf-8') if msg.key() else None
                value = msg.value().decode('utf-8')
                logger.info(f"[KAFKA CONSUME SUCCESS] Read event from topic: '{topic}' | Key: '{key}' | Value: {value}")
                
                try:
                    import json
                    event_data = json.loads(value)
                    
                    if topic == "notification.created":
                        # Route incoming notification event to the Distributed Fanout Service
                        if self.loop:
                            from app.core.notification_service import NotificationService
                            logger.info(f"Scheduling notification fanout for user '{event_data.get('user_id')}'...")
                            asyncio.run_coroutine_threadsafe(
                                NotificationService.process_and_fanout(
                                    user_id=str(event_data.get("user_id")),
                                    type_=event_data.get("type", "alert"),
                                    title=event_data.get("title", "Notification"),
                                    body=event_data.get("body", ""),
                                    actor_id=event_data.get("actor_id"),
                                    payload_json=event_data.get("payload_json")
                                ),
                                self.loop
                            )
                    elif topic == "graph.edge.updated":
                        # Invalidate graph set caches on this instance
                        if self.loop:
                            from app.core.privacy_service import PrivacyService
                            source = str(event_data.get("source_user_id"))
                            target = str(event_data.get("target_user_id"))
                            etype = event_data.get("edge_type")
                            
                            logger.info(f"Scheduling cache invalidation for source '{source}' edge type '{etype}'...")
                            asyncio.run_coroutine_threadsafe(
                                PrivacyService.invalidate_cache(source, etype),
                                self.loop
                            )
                            # Block invalidation is bidirectional for enforcement
                            if etype == "blocked":
                                asyncio.run_coroutine_threadsafe(
                                    PrivacyService.invalidate_cache(target, "blocked"),
                                    self.loop
                                )
                    elif topic == "feature.updated":
                        # Invalidate feature flag cache locally on this instance
                        if self.loop:
                            from app.core.feature_flag_service import FeatureFlagService
                            feature_name = event_data.get("feature_name")
                            logger.info(f"Scheduling feature flag cache invalidation for '{feature_name}'...")
                            asyncio.run_coroutine_threadsafe(
                                FeatureFlagService.invalidate_cache(feature_name),
                                self.loop
                            )
                    else:
                        # Route settings update broadcast
                        if self.loop:
                            from app.core.websocket import ws_manager
                            logger.info("Scheduling thread-safe WebSocket settings broadcast...")
                            asyncio.run_coroutine_threadsafe(
                                ws_manager.broadcast({
                                    "event": "user.setting.updated",
                                    "payload": event_data
                                }),
                                self.loop
                            )
                except Exception as ex:
                    logger.error(f"Failed to dispatch Kafka event: {str(ex)}")
        except Exception as e:
            logger.error(f"Kafka consumer daemon thread exception: {str(e)}")
        finally:
            if self.consumer:
                self.consumer.close()
                logger.info("Kafka consumer connection safely closed.")

    def stop(self):
        """Signal consumer thread to stop loop and wait for safe termination."""
        logger.info("Stopping background Kafka Consumer daemon thread...")
        self.running = False
        if self.thread:
            self.thread.join(timeout=3.0)

kafka_manager = KafkaManager()
kafka_consumer = KafkaConsumerWorker()
