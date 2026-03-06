# Запуск сервера
## 1. Сгенерировать ключи и положить в папку /keys
`openssl genrsa -out private_key.pem 4096`
`openssl rsa -in private_key.pem -pubout -out public_key.pem`
