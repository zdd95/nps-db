ENV_FILE    := .env
ENV_EXAMPLE := .env.example

.PHONY: help env

help: ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

env: ## Создать .env из .env.example (существующий не перезаписывается, FORCE=1 — перезаписать)
	@if [ ! -f $(ENV_EXAMPLE) ]; then \
		echo "❌ Не найден $(ENV_EXAMPLE)"; \
		exit 1; \
	fi
	@if [ -f $(ENV_FILE) ] && [ "$(FORCE)" != "1" ]; then \
		echo "⚠️  $(ENV_FILE) уже существует, ничего не меняю"; \
		echo "   Перезаписать: make env FORCE=1"; \
	else \
		cp $(ENV_EXAMPLE) $(ENV_FILE); \
		echo "✅ Создан $(ENV_FILE) из $(ENV_EXAMPLE)"; \
		echo "👉 Заполните DB_USER и DB_PASSWORD"; \
	fi
