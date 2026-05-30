# Scorekeeper — common project commands.
#
# App code and the Meteor toolchain live in ./app; container images are built and run with
# docker. Run `make` or `make help` to list targets.

APP     := app
IMAGE   := scorekeeper:latest
COMPOSE := docker compose -f $(APP)/docker-compose.yml

.DEFAULT_GOAL := help

.PHONY: help install dev lint lint-fix test test-server test-watch build up down logs ps clean

help: ## List available commands
	@awk 'BEGIN {FS = ":.*?## "} /^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5)} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

##@ Development (host Meteor toolchain)

install: ## Install npm dependencies (meteor npm install)
	cd $(APP) && meteor npm install

dev: ## Run the Meteor dev server (bundled MongoDB on :3001, app on :3000)
	cd $(APP) && meteor run

lint: ## Lint + format check (eslint + prettier)
	cd $(APP) && npm run lint

lint-fix: ## Auto-fix lint + formatting
	cd $(APP) && npm run lint:fix

test: ## Run the test suite once (client + server)
	cd $(APP) && npm test

test-server: ## Run only server tests once (TEST_CLIENT=0)
	cd $(APP) && TEST_CLIENT=0 npm test

test-watch: ## Run the test suite in watch mode
	cd $(APP) && npm run test-watch

##@ Containers (docker)

build: ## Build the production image with docker
	docker build -t $(IMAGE) $(APP)

up: ## Build + start the app and MongoDB via docker compose (detached)
	$(COMPOSE) up -d --build

down: ## Stop and remove the compose services
	$(COMPOSE) down

logs: ## Follow logs from the compose services
	$(COMPOSE) logs -f

ps: ## Show status of the compose services
	$(COMPOSE) ps

clean: ## Stop services, remove volumes, and delete the built image
	$(COMPOSE) down --volumes --remove-orphans
	-docker rmi -f $(IMAGE)
