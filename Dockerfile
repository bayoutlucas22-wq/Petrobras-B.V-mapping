FROM node:20.19-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY ["Consulta (15).csv", "/usr/share/nginx/html/Consulta (15).csv"]
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
