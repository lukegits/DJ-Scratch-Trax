Rails.application.routes.draw do
  resources :topics do
    resources :posts, except: [:index]
    resources :sponsored_posts, except: [:index]
  end

   resources :posts, only: [] do
 # #5
     resources :comments, only: [:create, :destroy]
     resources :favorites, only: [:create, :destroy]
     post '/up-vote' => 'votes#up_vote', as: :up_vote
     post '/down-vote' => 'votes#down_vote', as: :down_vote
   end
  # #7
  resources :users, only: [:new, :create, :show]

  resources :sessions, only: [:new, :create, :destroy]

  resources :questions

  post 'users/confirm' => 'users#confirm'
  get "Topics" => 'welcome#topics'
  get 'about' => 'welcome#about'
  get "/welcome/faq" => "welcome#faq"
  root to: 'welcome#index'
end
