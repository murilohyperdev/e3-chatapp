-- Runs once, on first initialisation of the data volume.
-- Separate database so the test suite never touches development data.
CREATE DATABASE e3chat_test OWNER e3chat;
