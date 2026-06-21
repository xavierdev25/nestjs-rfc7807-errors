# 🚀 NestJS Enterprise Architecture

Un monorepo robusto, de nivel de producción, diseñado para aplicaciones empresariales escalables. Esta arquitectura resuelve problemas críticos de consistencia de datos, seguridad, rendimiento en alta concurrencia y estandarización de errores mediante patrones de diseño avanzados y herramientas cloud-native.

## 🏗 Arquitectura del Sistema (Monorepo pnpm)

El proyecto está estructurado utilizando **pnpm workspaces**, promoviendo un diseño modular y desacoplado entre las librerías reutilizables y las aplicaciones de dominio.

```mermaid
graph TD
    subgraph Monorepo ["pnpm Workspace"]
        direction TB

        subgraph Libs ["Librerías / Paquetes Core"]
            A["@xavierdev25/rfc7807-errors"]
            A_Desc["Filtros globales, Tipos y Excepciones (Estandarización IETF)"] -.-> A
        end

        subgraph Apps ["Aplicaciones - Arquitectura Hexagonal"]
            B["apps/enterprise-demo"]

            subgraph Hexagonal ["Estructura Interna"]
                direction LR
                API["API REST / Controllers"] --> Domain["Dominio / Entidades / CQRS"]
                Domain --> Infra["Infraestructura / TypeORM / SQS"]
            end

            B --- Hexagonal
        end

        B == "Consume" ==> A
    end
```
