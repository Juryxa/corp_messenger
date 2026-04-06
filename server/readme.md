# Запуск сервера
## 1. Сгенерировать ключи для jwt. Запустите команды по одной в терминале в папке /server
### Они положатся в папку keys автоматически
`openssl ecparam -name prime256v1 -genkey -noout -out keys/ec_private_key.pem`
`openssl ec -in keys/ec_private_key.pem -pubout -out keys/ec_public_key.pem`
