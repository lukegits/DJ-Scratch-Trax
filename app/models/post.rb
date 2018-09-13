class Post < ApplicationRecord
   belongs_to :topic
   belongs_to :user
   has_many :comments, dependent: :destroy
   has_many :votes, dependent: :destroy

   default_scope { order('created_at DESC') }
   validates :title, length: { minimum: 5 }, presence: true
     validates :body, length: { minimum: 20 }, presence: true
     validates :topic, presence: true
      validates :user, presence: true


         def up_votes
       # #9
           votes.where(value: 1).count
         end

         def down_votes
       # #10
           votes.where(value: -1).count
         end

         def points
       # #11
           votes.sum(:value)
         end

end
